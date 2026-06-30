import { existsSync } from 'node:fs';

const shouldEnforceRuntime = process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'production';

if (!shouldEnforceRuntime) {
  process.exit(0);
}

try {
  const playwright = await import('playwright');
  const executablePath =
    typeof playwright.chromium?.executablePath === 'function'
      ? playwright.chromium.executablePath()
      : null;

  if (!executablePath || !existsSync(executablePath)) {
    console.error('[playwright-runtime] Chromium executable missing for production build');
    process.exit(1);
  }
} catch (error) {
  console.error('[playwright-runtime] Unable to validate Playwright runtime', error);
  process.exit(1);
}
