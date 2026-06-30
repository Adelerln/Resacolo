import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const shouldProvisionBrowser =
  process.env.VERCEL === '1' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.INSTALL_PLAYWRIGHT_CHROMIUM === '1';

if (!shouldProvisionBrowser) {
  process.exit(0);
}

const cliPath = path.join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
if (!existsSync(cliPath)) {
  console.warn('[playwright-runtime] playwright CLI not found, chromium install skipped');
  process.exit(0);
}

const result = spawnSync(process.execPath, [cliPath, 'install', 'chromium'], {
  stdio: 'inherit',
  env: process.env
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
