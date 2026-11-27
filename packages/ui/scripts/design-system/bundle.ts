// Builds the component bundle of the Shifa Design System (spec 0.4 criterion 12): one classic
// script (bundle-entry.tsx, React 19 inside, global `Shifa`), its stylesheet with the token
// values tokens.json does not carry (token-gaps.ts) and the compact density values, the types and a preview and guidelines per public component.
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
import { gapBlock } from './token-gaps.ts';
import { compileTokensCss, type DsTokens } from './tokens-css.ts';

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
  'Callout',
  'QrCode',
  'CodeList',
  'CopyField',
  'Avatar',
  'Toolbar',
  'Pagination',
  'DataTable',
  'UsageChart',
] as const;

/** The "Shifa Components" canvas: one sheet per component, every state, working in Play (ADR-0048). */
export const COMPONENTS_CANVAS = 'https://claude.ai/artifact/Kk3HMckdzqQ4yAyxWpu8kd';

/** The end of a component's guidelines: where its every state is shown (the system shows one card). */
export function sheetLink(name: string): string {
  return `\n## Every state\n\nEvery variant, size and state of the real component, working in Play: [${name} on Shifa Components](${COMPONENTS_CANVAS}#artboard-${name}). A screen imports the same component with any of its props (\`index.d.ts\`); this page shows one example.\n`;
}

/** Text that would end or escape an inline <script>, written so that it cannot. */
function inlineSafe(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script').replaceAll('<!--', '\\x3C!--');
}

const codeTokensCss = () =>
  readFileSync(join(root, 'packages', 'tokens', 'generated', 'css', 'tokens.css'), 'utf8');

/** The system's tokens.css as assemble.ts compiles it from tokens.json. */
export function systemTokensCss(): string {
  const json = readFileSync(
    join(root, 'packages', 'tokens', 'generated', 'design-system', 'tokens.json'),
    'utf8',
  );
  return compileTokensCss(JSON.parse(json) as DsTokens, 'Shifa Design System');
}

/** The `[data-density='compact']` block of the generated token CSS. */
function compactBlock(): string {
  const css = codeTokensCss();
  const start = css.indexOf("[data-density='compact'] {");
  if (start === -1) throw new Error('design-system bundle: no compact block in tokens.css');
  return css.slice(start, css.indexOf('}', start) + 1);
}

export async function buildBundle(out: string): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'shifa-bundle-build-'));
  // Vite takes `isProduction` from NODE_ENV, not from `mode`, and the React plugin compiles JSX to
  // `jsxDEV` when it is not production; production React has no `jsxDEV`, so every preview would
  // stay empty. The variable is set for the build only and restored after it.
  const callerNodeEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
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
    const gaps = gapBlock(css, systemTokensCss(), codeTokensCss());
    writeFileSync(join(dir, 'bundle.css'), `${css}\n${gaps}${compactBlock()}\n`);
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
        const source = join(here, 'components', name, file);
        if (file === 'README.md') {
          writeFileSync(
            join(dir, name, file),
            `${readFileSync(source, 'utf8').trimEnd()}\n${sheetLink(name)}`,
          );
        } else copyFileSync(source, join(dir, name, file));
      }
    }
  } finally {
    if (callerNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = callerNodeEnv;
    rmSync(tmp, { recursive: true, force: true });
  }
}
