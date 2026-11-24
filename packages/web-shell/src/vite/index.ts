// @shifa/web-shell/vite: the Vite configuration both apps share (slice A-01-06). One origin per
// app: the dev and preview servers proxy /api/* to the API with the prefix removed, the form of
// the rule the production proxy follows (docs/architecture/overview.md). Production builds use
// the `production` export condition, so UI SDK's development history never ships (P-N2).
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build, type ProxyOptions, type UserConfig } from 'vite';
import { shellServiceWorker } from './service-worker.ts';

export { precacheList, serviceWorkerSource, shellServiceWorker } from './service-worker.ts';

/** Where the API listens when nothing says otherwise (apps/api `API_PORT` default). */
export const DEFAULT_API_URL = 'http://127.0.0.1:3000';

/** `/api` and `/api/…` only (`/apix` stays with the app); the prefix is removed once. */
export function apiProxy(target: string): Record<string, ProxyOptions> {
  return {
    '^/api(?=/|\\?|$)': {
      target,
      changeOrigin: true,
      rewrite: (path) => {
        const rest = path.replace(/^\/api/, '');
        return rest.startsWith('/') ? rest : `/${rest}`;
      },
    },
  };
}

export interface ShellViteOptions {
  /** The app's port (clinic web 5173, admin web 5174). */
  port: number;
  mode?: string;
  /** The API's origin; defaults to SHIFA_API_URL, then DEFAULT_API_URL. */
  apiUrl?: string;
}

export function shellViteConfig({ port, mode, apiUrl }: ShellViteOptions): UserConfig {
  const proxy = apiProxy(apiUrl ?? process.env['SHIFA_API_URL'] ?? DEFAULT_API_URL);
  return {
    plugins: [react(), tailwindcss(), shellServiceWorker()],
    // Named outright for builds: the condition must not depend on NODE_ENV (tests set `test`).
    ...(mode === 'production'
      ? { resolve: { conditions: ['module', 'browser', 'production'] } }
      : {}),
    define: {
      'import.meta.env.SHIFA_APP_VERSION': JSON.stringify(
        process.env['npm_package_version'] ?? '0.0.0',
      ),
    },
    server: { port, strictPort: true, host: '127.0.0.1', proxy },
    preview: { port, strictPort: true, host: '127.0.0.1', proxy },
    build: { sourcemap: false },
  };
}

/** Markers of UI SDK's development history (as packages/ui/scripts/design-system/bundle.ts). */
export const DEV_HISTORY_MARKERS = ['ui-sdk.devtools', '__UI_SDK__'] as const;

export function devHistoryMarkers(js: string): string[] {
  return DEV_HISTORY_MARKERS.filter((marker) => js.includes(marker));
}

export interface CheckedBuild {
  /** Every emitted script, as [path in dist, text]. */
  scripts: [string, string][];
  serviceWorker: string;
  indexHtml: string;
  remove(): Promise<void>;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

/** Builds the app in `appDir` for production into a temporary folder, for the build tests. */
export async function buildForCheck(appDir: URL): Promise<CheckedBuild> {
  const root = fileURLToPath(appDir);
  const outDir = await mkdtemp(join(tmpdir(), 'shifa-web-build-'));
  await build({
    root,
    mode: 'production',
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  });
  const files = await listFiles(outDir);
  const scripts: [string, string][] = [];
  for (const file of files.filter((f) => /\.[cm]?js$/.test(f))) {
    scripts.push([relative(outDir, file), await readFile(file, 'utf8')]);
  }
  return {
    scripts,
    serviceWorker: await readFile(join(outDir, 'sw.js'), 'utf8'),
    indexHtml: await readFile(join(outDir, 'index.html'), 'utf8'),
    remove: () => rm(outDir, { recursive: true, force: true }),
  };
}
