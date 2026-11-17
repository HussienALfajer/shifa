import { defineConfig } from 'vitest/config';

// Every file starts its own PostgreSQL 18 container (Docker); the log scan also starts WAHA.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['../stack/test/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 600_000,
    testTimeout: 180_000,
  },
});
