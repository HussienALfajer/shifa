import { defineConfig } from 'vitest/config';

// The guard runs the real router on a memory history (happy-dom gives it the `window` it reads,
// nothing is rendered), the idle timer on a fake clock, the service worker in a vm sandbox. The
// pages are drawn in A-01-07.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'happy-dom',
    // The page tests render the whole shell; under verify's parallel load 5 s is too tight.
    testTimeout: 30_000,
  },
});
