import 'server-only';

type BrowserLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  setContent: (html: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }) => Promise<void>;
  evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
  pdf: (options: {
    format?: 'A4';
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  }) => Promise<Buffer>;
  close: () => Promise<void>;
};

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
    return (await playwrightCore.chromium.connect(endpoint)) as unknown as BrowserLike;
  }

  try {
    const playwright = await import('playwright');
    return (await playwright.chromium.launch({ headless: true })) as unknown as BrowserLike;
  } catch {
    // fall through to serverless chromium
  }

  const [playwrightCore, chromiumImport] = await Promise.all([
    import('playwright-core'),
    import('@sparticuz/chromium')
  ]);
  const chromiumModule = chromiumImport as unknown as {
    default?: {
      args?: string[];
      executablePath?: (input?: string) => Promise<string>;
      headless?: boolean | 'shell';
    };
    args?: string[];
    executablePath?: (input?: string) => Promise<string>;
    headless?: boolean | 'shell';
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
}

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fonts = (document as any).fonts;
        if (fonts?.ready) await fonts.ready;
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });
      return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}
