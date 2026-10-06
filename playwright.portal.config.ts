import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/portal',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4219', headless: true },
  webServer: {
    command: 'npm start -- --port 4219 --host 127.0.0.1',
    env: {
      SUPABASE_URL: 'https://portal-test.supabase.co',
      SUPABASE_ANON_KEY: 'public-test-key',
      DEMO_MODE: 'false',
    },
    url: 'http://127.0.0.1:4219',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
