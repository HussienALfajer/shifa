import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 900_000,
    testTimeout: 600_000,
  },
});
