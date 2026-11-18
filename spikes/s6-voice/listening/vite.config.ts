import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// A static page: the built bundle plus the served listening set (listening-set.json, the
// pre-round set and the clips under random codes), copied in from `publicDir`. The key is never in
// that folder. `--mode test` uses the fake set made by scripts/make-test-set.ts.
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir:
    mode === 'test'
      ? resolve(import.meta.dirname, 'test-set', 'served')
      : resolve(import.meta.dirname, '..', '.out', 'listening', 'served'),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
}));
