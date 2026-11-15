import { defineConfig } from 'vite';

// `VITE_ENGINE=outbox|powersync` picks the sync engine at build time; the spike server serves the
// built `dist-<engine>/` and the API on one origin. In dev, API calls go to the server on 4310.
// PowerSync's web SDK runs SQLite (wa-sqlite WASM) in workers: keep it out of dependency
// pre-bundling and emit ES-module workers.
export default defineConfig({
  server: {
    proxy: Object.fromEntries(
      ['/auth', '/commands', '/sync', '/report', '/powersync', '/.well-known'].map((p) => [
        p,
        'http://127.0.0.1:4310',
      ]),
    ),
  },
  optimizeDeps: { exclude: ['@journeyapps/wa-sqlite', '@powersync/web'] },
  build: { target: 'es2022', sourcemap: false },
  worker: { format: 'es' },
});
