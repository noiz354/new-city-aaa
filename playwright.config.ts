import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: 0,
  use: { headless: true },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
