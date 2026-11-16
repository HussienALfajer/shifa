import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The generator tests are CPU-bound (up to 300,000 phone draws in one test), and CI's node
    // job runs every package's tests at once on four cores; 5 s was too tight there.
    testTimeout: 30_000,
  },
});
