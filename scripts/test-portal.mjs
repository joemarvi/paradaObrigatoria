import { spawnSync } from 'node:child_process';
let result;
try {
  result = spawnSync('npx', ['playwright', 'test', '--config', 'playwright.portal.config.ts'], {
    stdio: 'inherit',
  });
} finally {
  // The portal server uses fake public configuration; restore the local configuration.
  const restored = spawnSync(process.execPath, ['scripts/environment.mjs'], { stdio: 'inherit' });
  if (restored.status !== 0) process.exitCode = 1;
}
process.exitCode ||= result?.status ?? 1;
