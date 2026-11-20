import { defineConfig } from 'vitest/config';

// Node tests for now; the browser project (Vitest browser mode on Playwright Chromium) comes with
// the Storybook harness in checkpoint B of slice 0.4-03.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
