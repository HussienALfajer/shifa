import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages (the kiosk display and the local control page) and the service worker, emitted at
// /sw.js unhashed so its scope is the whole origin. Built, then served by `vite preview`.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        control: resolve(import.meta.dirname, 'control.html'),
        sw: resolve(import.meta.dirname, 'src/sw/sw.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
