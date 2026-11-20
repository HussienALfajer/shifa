// Playwright Test for the story screenshots; started by scripts/screenshots.ts, which provides
// the browser of the pinned image (SHIFA_PW_WS). See that script for why.
import { defineConfig } from '@playwright/test';

const wsEndpoint = process.env['SHIFA_PW_WS'];
if (wsEndpoint === undefined) {
  throw new Error('run `pnpm --filter @shifa/ui screenshots`: it starts the pinned browser');
}
const PORT = 6107;

export default defineConfig({
  testDir: '.',
  testMatch: 'stories.spec.ts',
  outputDir: './results',
  snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  expect: {
    // Strict: a one-pixel style change fails (slice 0.4-03, red/green proof).
    toHaveScreenshot: { maxDiffPixels: 0, threshold: 0.1, animations: 'disabled', scale: 'css' },
  },
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    // The browser in the image reaches this machine through the connection, on the Storybook
    // port only (never the other local services: databases, Grafana, Docker).
    connectOptions: { wsEndpoint, exposeNetwork: `localhost:${String(PORT)}` },
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'ar',
  },
  webServer: {
    command: `node ../scripts/serve-static.ts ../storybook-static ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}/index.json`,
    reuseExistingServer: false,
  },
});
