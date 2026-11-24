import { defineConfig } from 'vitest/config';

// Node only: the production build test builds the app with Vite into a temporary folder.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
