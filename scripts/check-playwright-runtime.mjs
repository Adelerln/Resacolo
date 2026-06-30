import { existsSync } from 'node:fs';

const shouldEnforceRuntime =
  process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

if (!shouldEnforceRuntime) {
  process.exit(0);
}

try {
  const [playwright, chromiumModule] = await Promise.all([import('playwright-core'), import('@sparticuz/chromium')]);
  const chromium = chromiumModule.default ?? chromiumModule;
  const executablePath =
    typeof chromium.executablePath === 'function' ? await chromium.executablePath() : null;

  if (!playwright.chromium || !executablePath || !existsSync(executablePath)) {
    console.error('[playwright-runtime] Chromium executable missing for production build');
    process.exit(1);
  }
} catch (error) {
  console.error('[playwright-runtime] Unable to validate Playwright runtime', error);
  process.exit(1);
}
