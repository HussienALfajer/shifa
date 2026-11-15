import { defineConfig } from 'vitest/config';

// Engine unit tests: IndexedDB from fake-indexeddb, fetch stubbed. No browser, no Docker.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
});
