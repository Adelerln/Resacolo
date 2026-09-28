import 'server-only';

import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

type BrowserLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  setContent: (
    html: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }
  ) => Promise<void>;
  goto: (
    url: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }
  ) => Promise<unknown>;
  evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
  pdf: (options: {
    format?: 'A4';
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  }) => Promise<Buffer>;
  close: () => Promise<void>;
};

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalChromiumExecutable(): Promise<string | null> {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (envPath && (await pathExists(envPath))) return envPath;

  const cacheRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() || join(homedir(), 'Library/Caches/ms-playwright');
  const candidates = [
    join(cacheRoot, 'chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
    join(cacheRoot, 'chromium_headless_shell-1217/chrome-headless-shell-mac-x64/chrome-headless-shell'),
    join(
      cacheRoot,
      'chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    ),
    join(
      cacheRoot,
      'chromium-1217/chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    ),
    join(cacheRoot, 'chromium-1217/chrome-linux/chrome'),
    join(cacheRoot, 'chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell')
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

function isRemotePlaywrightConfigured() {
  return Boolean(process.env.PLAYWRIGHT_REMOTE_WS_ENDPOINT?.trim());
}

async function launchChromiumBrowser(): Promise<BrowserLike> {
  const remoteEndpoint = process.env.PLAYWRIGHT_REMOTE_WS_ENDPOINT?.trim();
  if (remoteEndpoint) {
    const playwrightCore = await import('playwright-core');
    const token = process.env.PLAYWRIGHT_REMOTE_TOKEN?.trim();
    let endpoint = remoteEndpoint;
    try {
      const url = new URL(remoteEndpoint);
      if (token && !url.searchParams.has('token')) {
        url.searchParams.set('token', token);
      }
      endpoint = url.toString();
    } catch {
      // keep raw endpoint
    }
    return (await playwrightCore.chromium.connect(endpoint, { timeout: 30_000 })) as unknown as BrowserLike;
  }

  const localExecutable = await resolveLocalChromiumExecutable();
  const launchErrors: string[] = [];

  try {
    const playwright = await import('playwright');
    return (await playwright.chromium.launch({
      headless: true,
      ...(localExecutable ? { executablePath: localExecutable } : {})
    })) as unknown as BrowserLike;
  } catch (error) {
    launchErrors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const playwrightCore = await import('playwright-core');
    if (localExecutable) {
      return (await playwrightCore.chromium.launch({
        headless: true,
        executablePath: localExecutable
      })) as unknown as BrowserLike;
    }
  } catch (error) {
    launchErrors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const [playwrightCore, chromiumImport] = await Promise.all([
      import('playwright-core'),
      import('@sparticuz/chromium')
    ]);
    const chromiumModule = chromiumImport as unknown as {
      default?: {
        args?: string[];
        executablePath?: (input?: string) => Promise<string>;
      };
      args?: string[];
      executablePath?: (input?: string) => Promise<string>;
    };
    const chromium = chromiumModule.default ?? chromiumModule;
    const executablePath =
      typeof chromium.executablePath === 'function' ? await chromium.executablePath() : undefined;
    const args = Array.isArray(chromium.args) ? chromium.args : [];
    return (await playwrightCore.chromium.launch({
      args,
      executablePath,
      headless: true
    })) as unknown as BrowserLike;
  } catch (error) {
    launchErrors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`Impossible de lancer Chromium pour le PDF facture : ${launchErrors.join(' | ')}`);
}

async function waitForRaleway(page: PageLike) {
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 12px Raleway'),
      document.fonts.load('700 12px Raleway'),
      document.fonts.load('400 16px Raleway'),
      document.fonts.load('700 16px Raleway')
    ]);
    await document.fonts.ready;
    return document.fonts.check('400 12px Raleway') && document.fonts.check('700 12px Raleway');
  });
  if (!fontOk) {
    throw new Error('Police Raleway non chargée avant génération du PDF.');
  }
}

async function pdfFromPage(page: PageLike): Promise<Buffer> {
  await waitForRaleway(page);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
}

/**
 * Rend un HTML en PDF A4 via Chromium avec Raleway embarquée.
 * 1) file:// local (meilleur embedding fonts)
 * 2) sinon setContent (data: URLs / remote browser)
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await launchChromiumBrowser();
  const errors: string[] = [];

  try {
    // Stratégie 1 : fichier local — Raleway via file:// bien embarquée dans le PDF.
    if (!isRemotePlaywrightConfigured()) {
      const tempDir = await mkdtemp(join(tmpdir(), 'resacolo-invoice-'));
      const htmlPath = join(tempDir, 'invoice.html');
      try {
        await writeFile(htmlPath, html, 'utf8');
        const page = await browser.newPage();
        try {
          await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 45_000 });
          return await pdfFromPage(page);
        } finally {
          await page.close().catch(() => undefined);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    // Stratégie 2 : setContent (data URLs ou navigateur distant).
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
      return await pdfFromPage(page);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      throw new Error(`Rendu PDF Chromium impossible (Raleway) : ${errors.join(' | ')}`);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}
