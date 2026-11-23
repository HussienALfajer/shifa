// Builds the component bundle of the Shifa Design System (spec 0.4 criterion 12): one classic
// script (bundle-entry.tsx, React 19 inside, global `Shifa`), its stylesheet with the compact
// density values, the types and a preview and guidelines per public component.
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const here = import.meta.dirname;
const pkg = join(here, '..', '..');
const root = join(pkg, '..', '..');

/** Markers of UI SDK's development history in a built script (P-N2, slice 0.4-12). */
export const DEV_HISTORY_MARKERS = ['ui-sdk.devtools', '__UI_SDK__'] as const;

/**
 * The development-history markers found in `js`. UI SDK keeps a history for its devtools when
 * built with NODE_ENV=development; the bundle is built for production, so it has none, and a
 * staging build never runs with NODE_ENV=development (design doc, "Builds").
 */
export function devHistoryMarkers(js: string): string[] {
  return DEV_HISTORY_MARKERS.filter((marker) => js.includes(marker));
}

/** The public components, in the order of bundle-entry.tsx; each has a folder in ./components. */
export const BUNDLE_COMPONENTS = [
  'Button',
  'Icon',
  'Tabs',
  'Dialog',
  'Popover',
  'Menu',
  'Select',
  'Combobox',
  'NumberInput',
  'DatePicker',
  'IconButton',
  'Input',
  'Textarea',
  'PasswordInput',
  'Checkbox',
  'RadioGroup',
  'Switch',
  'OtpInput',
  'TimeInput',
  'Field',
  'Form',
  'Tooltip',
  'Accordion',
  'SegmentedControl',
  'AlertDialog',
  'Drawer',
  'Toast',
  'CommandPalette',
  'Spinner',
  'Badge',
  'CountBadge',
  'Skeleton',
  'Card',
  'EmptyState',
  'Avatar',
  'Toolbar',
  'Pagination',
  'DataTable',
] as const;

/** Text that would end or escape an inline <script>, written so that it cannot. */
function inlineSafe(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script').replaceAll('<!--', '\\x3C!--');
}

/** The `[data-density='compact']` block of the generated token CSS. */
function compactBlock(): string {
  const css = readFileSync(
    join(root, 'packages', 'tokens', 'generated', 'css', 'tokens.css'),
    'utf8',
  );
  const start = css.indexOf("[data-density='compact'] {");
  if (start === -1) throw new Error('design-system bundle: no compact block in tokens.css');
  return css.slice(start, css.indexOf('}', start) + 1);
}

export async function buildBundle(out: string): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'shifa-bundle-build-'));
  try {
    await build({
      configFile: false,
      root: pkg,
      logLevel: 'warn',
      plugins: [react(), tailwindcss()],
      // Production whatever NODE_ENV the caller runs with (Vitest sets "test"): Vite picks the
      // `development` export condition from NODE_ENV otherwise, and UI SDK's `#dev` import then
      // brings its development history (devtools hook, `__UI_SDK__`) into the bundle (P-N2).
      mode: 'production',
      resolve: { conditions: ['module', 'browser', 'production'] },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        outDir: tmp,
        emptyOutDir: true,
        minify: true,
        cssCodeSplit: false,
        lib: {
          entry: join(here, 'bundle-entry.tsx'),
          formats: ['iife'],
          name: 'ShifaBundle',
          fileName: () => 'bundle.js',
          cssFileName: 'bundle',
        },
      },
    });
    const dir = join(out, 'components');
    mkdirSync(dir, { recursive: true });
    const header = {
      format: 4,
      namespace: 'Shifa',
      components: BUNDLE_COMPONENTS.map((name) => ({ name })),
    };
    const js = inlineSafe(readFileSync(join(tmp, 'bundle.js'), 'utf8'));
    writeFileSync(join(dir, 'bundle.js'), `/* @ds-bundle: ${JSON.stringify(header)} */\n${js}`);
    const css = readFileSync(join(tmp, 'bundle.css'), 'utf8');
    writeFileSync(join(dir, 'bundle.css'), `${css}\n${compactBlock()}\n`);
    // One types file for the system: the data-display types follow the rest (without their import).
    const dataTypes = readFileSync(join(here, 'index-data.d.ts'), 'utf8').replace(
      /^[\s\S]*?import type[^\n]*\n/,
      '',
    );
    writeFileSync(
      join(dir, 'index.d.ts'),
      `${readFileSync(join(here, 'index.d.ts'), 'utf8')}\n${dataTypes}`,
    );
    for (const name of BUNDLE_COMPONENTS) {
      mkdirSync(join(dir, name), { recursive: true });
      for (const file of readdirSync(join(here, 'components', name))) {
        copyFileSync(join(here, 'components', name, file), join(dir, name, file));
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
