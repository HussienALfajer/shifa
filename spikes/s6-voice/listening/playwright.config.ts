import { defineConfig } from '@playwright/test';

// Criteria 2 and 5 in Chromium against the production build served by `vite preview` (the fake
// test set is made by scripts/make-test-set.ts). Audio may start without a tap, as the owner's
// first click would allow.
const PORT = 4319;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results/output',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    browserName: 'chromium',
    locale: 'ar-SY',
    timezoneId: 'Asia/Damascus',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `pnpm exec vite preview --mode test --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
