import { existsSync } from 'node:fs';
import path from 'node:path';

const shouldEnforceRuntime =
  process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

if (!shouldEnforceRuntime) {
  process.exit(0);
}

function sparticuzChromiumBinCandidates() {
  const cwd = process.cwd();
  return [
    path.join(cwd, 'node_modules/@sparticuz/chromium/bin'),
    path.join(cwd, '.next/server/node_modules/@sparticuz/chromium/bin'),
    path.join(cwd, '.next/standalone/node_modules/@sparticuz/chromium/bin')
  ];
}

async function resolveSparticuzExecutablePath(chromium) {
  for (const binPath of sparticuzChromiumBinCandidates()) {
    if (!existsSync(binPath)) continue;
    try {
      const resolved = await chromium.executablePath(binPath);
      if (typeof resolved === 'string' && resolved.trim().length > 0) {
        return resolved.trim();
      }
    } catch {
      // try next candidate
    }
  }

  return typeof chromium.executablePath === 'function' ? chromium.executablePath() : null;
}

try {
  const [playwright, chromiumModule] = await Promise.all([import('playwright-core'), import('@sparticuz/chromium')]);
  const chromium = chromiumModule.default ?? chromiumModule;
  const executablePath = await resolveSparticuzExecutablePath(chromium);
  const bundledBinPath = sparticuzChromiumBinCandidates().find((candidate) => existsSync(candidate)) ?? null;

  if (!playwright.chromium || !executablePath || !existsSync(executablePath)) {
    console.error('[playwright-runtime] Chromium executable missing for production build', {
      bundledBinPath,
      executablePath
    });
    process.exit(1);
  }
} catch (error) {
  console.error('[playwright-runtime] Unable to validate Playwright runtime', error);
  process.exit(1);
}
