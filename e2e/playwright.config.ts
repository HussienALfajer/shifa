// The journeys of slice A-01-06: Chromium against the built API, a real database and the built
// apps, all started by support/global-setup.ts. Serial (the seeded setup links are one-time),
// service workers blocked but in the one journey that checks the shell loads from it, no trace
// unless E2E_TRACE=1 (then kept for failures only, uploaded by CI).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  globalSetup: './support/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'ar-SY',
    trace: process.env['E2E_TRACE'] === '1' ? 'retain-on-failure' : 'off',
    serviceWorkers: 'block',
  },
});
