import { defineConfig } from 'vitest/config';

// Every file starts Gotenberg, the canary and poppler in containers: one file at a time.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 300_000,
    testTimeout: 120_000,
  },
});
