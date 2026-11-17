import { defineConfig } from 'vitest/config';

// Clinic-side scenarios (0.3-S4b): every file starts its own stack with the browser on the
// clinic network and no ops tunnel. One file at a time; P1 runs are long.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts', 'bench/**/*.test.ts'],
    globalSetup: ['../stack/test/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 1_800_000,
    testTimeout: 14_400_000,
  },
});
