import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: 0,
  use: { headless: true, baseURL: 'http://localhost:5180' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
