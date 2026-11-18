import { defineConfig } from '@playwright/test';

// Criteria 7-8 in Chromium. `default` launches with Chrome's desktop autoplay policy (a page needs
// one tap before audio); `kiosk` with the kiosk setting (no gesture needed), as a TV box would be
// configured. Every spec runs in both; the autoplay spec checks the project it runs in. The page is
// the production build served by `vite preview` (the test pack is made by scripts/make-test-pack).
const PORT = 4318;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results/output',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    locale: 'ar-SY',
    timezoneId: 'Asia/Damascus',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'default',
      use: {
        browserName: 'chromium',
        launchOptions: { args: ['--autoplay-policy=document-user-activation-required'] },
      },
    },
    {
      name: 'kiosk',
      use: {
        browserName: 'chromium',
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
