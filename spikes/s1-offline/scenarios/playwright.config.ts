import { defineConfig } from '@playwright/test';
import { pinTestcontainersHelpers } from './harness/images.ts';

// Before global setup imports testcontainers (it reads the helper images at load time).
pinTestcontainersHelpers();

// Scenario suite (criteria 6-10): run with `ENGINE=outbox|powersync pnpm scenario`. Specs share
// one stack and run one at a time (they share a branch and its cash session).
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results/output',
  use: {
    locale: 'ar-SY',
    timezoneId: 'Asia/Damascus',
    // Traces record request headers (bearer tokens): local runs only, never in CI artefacts.
    trace: process.env['CI'] ? 'off' : 'retain-on-failure',
  },
});
