import { defineConfig } from 'vite';

// The page is served by the gateway at /upload/ (index.html) and /upload/assets/*.
export default defineConfig({
  base: '/upload/',
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true, target: 'es2022' },
});
