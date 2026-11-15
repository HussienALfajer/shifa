import { defineConfig } from 'vite';

// `VITE_ENGINE=outbox|powersync` picks the sync engine at build time; the spike server serves the
// built `dist/` and the API on one origin. In dev, API calls go to the server on port 4310.
export default defineConfig({
  server: {
    proxy: Object.fromEntries(
      ['/auth', '/commands', '/sync', '/report', '/powersync', '/.well-known'].map((p) => [
        p,
        'http://127.0.0.1:4310',
      ]),
    ),
  },
  build: { target: 'es2022', sourcemap: false },
  worker: { format: 'es' },
});
