import { defineConfig } from 'vitest/config';

// Every file starts its own imaging stack (Docker): one file at a time, long hooks.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 900_000,
    testTimeout: 600_000,
  },
});
