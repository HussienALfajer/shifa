import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    // public-cbct.test.ts downloads the 268 MB public case in its beforeAll from a server that
    // gives about 170 KB/s (about 26 minutes); 15 minutes was not enough on the CI runner. The
    // s4-imaging job's own timeout (120 minutes) still bounds the whole run.
    hookTimeout: 3_600_000,
    testTimeout: 600_000,
  },
});
