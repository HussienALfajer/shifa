import { defineConfig } from 'vitest/config';

// No Docker and no vendor: every provider call goes to the fake provider or a local mock server.
// `silma.test.ts` runs only with S6_SILMA=1 on the owner's machine (OD-50).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
