import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Three projects (slice 0.4-03):
// - node: unit tests, run by `verify` fast (`pnpm test`);
// - browser: component and helper tests in Chromium through Playwright (`pnpm test:browser`);
// - storybook: every story as a test, interactions and axe (`pnpm test:storybook`).
// The browser projects run in verify's `ui` part and CI, not in `verify` fast.
// A fresh object per project: Vitest names the instance after its project in place.
const chromium = () => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: 'chromium' as const }],
  viewport: { width: 1280, height: 800 },
});

// The UI SDK entries the components use, pre-bundled before the first test: found mid-run, Vite
// re-optimises them and reloads the page, and that run fails (duplicate React, missing module).
const optimizeDeps = {
  include: [
    'button',
    'calendar',
    'combobox',
    'date-picker',
    'dialog',
    'field',
    'menu',
    'number-input',
    'popover',
    'select',
    'tabs',
  ].map((entry) => `@ui-sdk/react/${entry}`),
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        plugins: [react(), tailwindcss()],
        optimizeDeps,
        test: {
          name: 'browser',
          include: ['test/**/*.test.tsx', 'src/**/*.test.tsx'],
          setupFiles: ['./test/setup.ts'],
          browser: chromium(),
        },
      },
      {
        // addon-vitest applies the preview and the a11y annotations itself (Storybook 10.3+).
        plugins: [tailwindcss(), storybookTest({ configDir: '.storybook' })],
        optimizeDeps,
        test: {
          name: 'storybook',
          browser: chromium(),
        },
      },
    ],
  },
});
