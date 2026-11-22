// Builds the generated outputs from the token source with Style Dictionary v5:
//   packages/tokens/generated/css/tokens.css          — CSS custom properties: light on :root,
//                                                       then what changes in dark and in compact
//   packages/tokens/generated/css/tailwind-theme.css  — Tailwind v4 theme names → those properties
//   packages/shifa_ui/lib/src/generated/tokens.g.dart — Dart constants: both themes, both densities
//   packages/tokens/generated/design-system/tokens.json — the Shifa Design System's tokens
//                                                       (design-system.ts; ADR-0040)
//   packages/shifa_ui/fonts/                           — the static TTFs of fonts.json and their
//                                                       OFL, copied as they are for Flutter
// Style Dictionary resolves references, names tokens and runs the value transforms of values.ts,
// once per mode (light, dark, compact); the three results are laid out by formats.ts.
// `build()` is pure (tests use it); the CLI is what the `tokens` drift check runs:
//   node packages/tokens/scripts/build.ts [outRoot] [sourceDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';
import {
  checkSchema,
  contrastProblems,
  type FlatToken,
  flatten,
  type Layer,
  loadSources,
  type Mode,
  type Sources,
  valueIn,
} from '../src/index.ts';
import { designSystem, FONTS_DIR, type FontFamily, loadFonts } from './design-system.ts';
import { css, dart, tailwind } from './formats.ts';
import { cssValue, dartValue } from './values.ts';

/** Repository-relative paths of the generated files. */
export const OUTPUTS = {
  css: 'packages/tokens/generated/css/tokens.css',
  tailwind: 'packages/tokens/generated/css/tailwind-theme.css',
  dart: 'packages/shifa_ui/lib/src/generated/tokens.g.dart',
  designSystem: 'packages/tokens/generated/design-system/tokens.json',
} as const;

/** Repository-relative directory of the Flutter font copies (`flutterFonts`, binary). */
export const FLUTTER_FONTS_DIR = 'packages/shifa_ui/fonts';

/** One token after Style Dictionary: named, resolved and written for its platform. */
export interface BuiltToken {
  /** `shifa-color-bg-surface` (CSS) or `colorBgSurface` (Dart). */
  name: string;
  path: string;
  type: string;
  layer: Layer;
  value: string;
}

/** The tokens of one platform in each mode, in the same order. */
export interface BuiltModes {
  light: BuiltToken[];
  dark: BuiltToken[];
  compact: BuiltToken[];
}

type Tree = Record<string, unknown>;

/** The Style Dictionary input for one mode: every token with the value it holds in that mode. */
function treeFor(tokens: FlatToken[], mode?: Mode): Tree {
  const root: Tree = {};
  for (const token of tokens) {
    const segments = token.path.split('.');
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      node[segment] ??= {};
      node = node[segment] as Tree;
    }
    node[segments.at(-1) ?? ''] = {
      $type: token.type,
      $value: valueIn(token, mode),
      layer: token.layer,
    };
  }
  return root;
}

interface SdToken {
  name: string;
  path: string[];
  $type?: string;
  $value?: unknown;
  layer?: Layer;
}

async function platforms(
  tokens: FlatToken[],
  mode?: Mode,
): Promise<{ css: BuiltToken[]; dart: BuiltToken[] }> {
  const sd = new StyleDictionary(
    {
      usesDtcg: true,
      tokens: treeFor(tokens, mode) as Record<string, never>,
      log: { verbosity: 'silent', warnings: 'disabled' },
      hooks: {
        transforms: {
          'shifa/css': {
            type: 'value',
            transform: (token) => cssValue(String(token.$type), token.$value),
          },
          'shifa/dart': {
            type: 'value',
            transform: (token) => dartValue(String(token.$type), token.$value),
          },
        },
      },
      platforms: {
        css: { prefix: 'shifa', transforms: ['name/kebab', 'shifa/css'] },
        dart: { transforms: ['name/camel', 'shifa/dart'] },
      },
    },
    { verbosity: 'silent', warnings: 'disabled' },
  );
  await sd.hasInitialized;
  const read = async (platform: string): Promise<BuiltToken[]> => {
    const dictionary = await sd.getPlatformTokens(platform, { cache: false });
    return (dictionary.allTokens as SdToken[]).map((token) => ({
      name: token.name,
      path: token.path.join('.'),
      type: String(token.$type),
      layer: token.layer ?? 'primitive',
      value: String(token.$value),
    }));
  };
  return { css: await read('css'), dart: await read('dart') };
}

/**
 * Repository-relative output path → file content. Throws when the source is not valid. `fonts`
 * (from `fonts/fonts.json`) only feeds the design-system file; tests may leave it out.
 */
export async function build(
  sources: Sources,
  fonts: FontFamily[] = [],
): Promise<Record<string, string>> {
  const problems = [...checkSchema(sources), ...contrastProblems(sources)];
  if (problems.length > 0) {
    throw new Error(`the token source is not valid:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  }
  const tokens = flatten(sources);
  const [light, dark, compact] = await Promise.all([
    platforms(tokens),
    platforms(tokens, 'dark'),
    platforms(tokens, 'compact'),
  ]);
  const web: BuiltModes = { light: light.css, dark: dark.css, compact: compact.css };
  const flutter: BuiltModes = { light: light.dart, dark: dark.dart, compact: compact.dart };
  return {
    [OUTPUTS.css]: css(web),
    [OUTPUTS.tailwind]: tailwind(web.light),
    [OUTPUTS.dart]: dart(flutter),
    [OUTPUTS.designSystem]: `${JSON.stringify(designSystem(tokens, light.css, fonts), null, 2)}\n`,
  };
}

/**
 * The Flutter copies of the fonts: every static TTF of `fonts.json` and each family's OFL
 * (`<id>-OFL.txt`), byte for byte, for `packages/shifa_ui/pubspec.yaml` to declare.
 */
export function flutterFonts(
  fonts: FontFamily[],
  fontsDir: string = FONTS_DIR,
): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  for (const family of fonts) {
    for (const file of family.files.filter((f) => f.format === 'ttf')) {
      files[`${FLUTTER_FONTS_DIR}/${basename(file.path)}`] = readFileSync(
        join(fontsDir, file.path),
      );
    }
    if (family.id !== undefined && family.licence !== undefined) {
      files[`${FLUTTER_FONTS_DIR}/${family.id}-OFL.txt`] = readFileSync(
        join(fontsDir, family.licence),
      );
    }
  }
  return files;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outRoot = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..', '..'));
  const sourceDir = process.argv[3];
  const fontsDir = sourceDir === undefined ? FONTS_DIR : join(sourceDir, '..', 'fonts');
  const fonts = loadFonts(fontsDir);
  const files = {
    ...(await build(loadSources(sourceDir), fonts)),
    ...flutterFonts(fonts, fontsDir),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(outRoot, path)), { recursive: true });
    writeFileSync(join(outRoot, path), text);
  }
}
