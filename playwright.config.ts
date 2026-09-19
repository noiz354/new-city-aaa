import { defineConfig } from '@playwright/test';

// Sandboxes without a Playwright browser download can point PW_CHROMIUM_PATH at any Chromium
// binary (e.g. one unpacked from an npm-distributed build). The flags below are the serverless
// headless set (no zygote, in-process GPU, SwiftShader via ANGLE) — WebGL2 works there in
// software. NOT --single-process: it takes the whole browser down when a WebGL page closes.
// Unset → Playwright's own managed Chromium, unchanged behaviour.
const sandboxChromium = process.env['PW_CHROMIUM_PATH'];
const sandboxArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--no-zygote',
  '--in-process-gpu',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--font-render-hinting=none',
  '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
];

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: sandboxChromium ? 1 : 0, // software GL is slow; one retry absorbs first-frame timing
  workers: 1,
  use: {
    headless: true,
    baseURL: 'http://localhost:5180',
    ...(sandboxChromium ? { launchOptions: { executablePath: sandboxChromium, args: sandboxArgs } } : {}),
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
