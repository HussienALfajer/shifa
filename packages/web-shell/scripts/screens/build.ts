// Builds the screens bundle of the "Shifa Screens · Clinic web" canvas: clinic web's pages and
// shell with the canvas's fake server (entry.tsx), one classic script and one stylesheet with the
// app's fonts and images inlined. Usage: node scripts/screens/build.ts <out-dir>
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const here = import.meta.dirname;
const pkg = join(here, '..', '..');

/** Text that would end or escape an inline <script>, written so that it cannot. */
const inlineSafe = (js: string) =>
  js.replace(/<\/script/gi, '<\\/script').replaceAll('<!--', '\\x3C!--');

export async function buildScreens(out: string): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'shifa-screens-build-'));
  // As the design-system bundle: the React plugin compiles JSX for production only when NODE_ENV
  // says so, and the `production` export condition keeps UI SDK's development history out.
  const callerNodeEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    await build({
      configFile: false,
      root: pkg,
      logLevel: 'warn',
      plugins: [react(), tailwindcss()],
      mode: 'production',
      resolve: { conditions: ['module', 'browser', 'production'] },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        outDir: tmp,
        emptyOutDir: true,
        minify: true,
        cssCodeSplit: false,
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        lib: {
          entry: join(here, 'entry.tsx'),
          formats: ['iife'],
          name: 'ShifaScreensBundle',
          fileName: () => 'screens.js',
          cssFileName: 'screens',
        },
      },
    });
    mkdirSync(out, { recursive: true });
    writeFileSync(
      join(out, 'screens.js'),
      inlineSafe(readFileSync(join(tmp, 'screens.js'), 'utf8')),
    );
    writeFileSync(join(out, 'screens.css'), readFileSync(join(tmp, 'screens.css'), 'utf8'));
  } finally {
    if (callerNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = callerNodeEnv;
    rmSync(tmp, { recursive: true, force: true });
  }
}

const target = process.argv[2];
if (import.meta.main && target) await buildScreens(resolve(target));
