// Assembles the Shifa Design System's files from the repository (slice 0.4-03, ADR-0040):
// the brand book, tokens.json (the generated token output), a compiled tokens.css, the static
// fonts with IBM Plex Sans Arabic renamed (OD-59), the logos, an Icons group and the cover. The
// component bundle is bundle.ts. Paths are those of the system's `project/` folder.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renameFamily } from '../../../../scripts/lib/font-rename.mjs';
import { HEALTH_FILES, PHOSPHOR, type PhosphorName } from '../../src/icons/phosphor.ts';
import { compileTokensCss, type DsTokens } from './tokens-css.ts';

const here = import.meta.dirname;
const pkg = join(here, '..', '..');
const root = join(pkg, '..', '..');
const fontsDir = join(root, 'packages', 'tokens', 'fonts');
const logoDir = join(root, 'docs', 'brand', 'logo');

/** The system's name, line 1 of tokens.css. */
export const TITLE = 'Shifa Design System';

/** The logo files the system shows (the Android adaptive layers stay in the repository). */
export const LOGOS = [
  ...['horizontal', 'stacked'].flatMap((form) =>
    ['color', 'reverse', 'mono', 'white'].map((ink) => `shifa-logo-${form}-${ink}.svg`),
  ),
  ...['color', 'reverse', 'mono', 'white'].map((ink) => `shifa-mark-${ink}.svg`),
  'shifa-app-icon.svg',
  'favicon.svg',
];

/** A representative icon set: common actions, status, sync, direction and the health glyphs. */
export const ICONS: readonly PhosphorName[] = [
  'calendar-plus',
  'calendar',
  'clock',
  'printer',
  'plus',
  'check',
  'x',
  'pencil',
  'trash',
  'magnifying-glass',
  'user',
  'users',
  'phone',
  'bell',
  'info',
  'warning',
  'check-circle',
  'cloud-check',
  'wifi-slash',
  'arrow-forward',
  'caret-forward',
  'sign-out',
];

/** The ink of the icon files: `shifa-color-icon-default` in light. */
export const ICON_INK = '#5b6a63';
const ICON_SIZE = 48;

interface FontFamily {
  family: string;
  webFamily?: string;
  files: { path: string; format: string }[];
}

function write(out: string, path: string, data: string | Buffer) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

/** The static fonts; a family served under another name (OD-59) is renamed inside the file. */
function fonts(out: string) {
  const manifest = JSON.parse(readFileSync(join(fontsDir, 'fonts.json'), 'utf8')) as {
    families: FontFamily[];
  };
  for (const family of manifest.families) {
    const web = family.webFamily ?? family.family;
    for (const file of family.files.filter((f) => f.format === 'ttf')) {
      const name = file.path.slice(file.path.lastIndexOf('/') + 1);
      let bytes: Buffer = readFileSync(join(fontsDir, file.path));
      if (web !== family.family) {
        bytes = renameFamily(bytes, {
          replace: {
            [family.family]: web,
            [family.family.replaceAll(' ', '')]: web.replaceAll(' ', ''),
          },
          reserved: /plex/i,
        });
      }
      write(out, `fonts/${name}`, bytes);
    }
  }
}

/** One icon file, drawn in the ink, with its own size. */
function iconSvg(name: PhosphorName): string {
  const markup = renderToStaticMarkup(
    createElement(PHOSPHOR[name], { weight: 'duotone', size: ICON_SIZE, color: ICON_INK }),
  );
  return markup.includes('xmlns=')
    ? markup
    : markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
}

function healthSvg(name: string): string {
  const source = readFileSync(join(pkg, 'src', 'icons', 'health', `${name}.svg`), 'utf8');
  return source
    .replaceAll('currentColor', ICON_INK)
    .replace(/width="24" height="24"/, `width="${String(ICON_SIZE)}" height="${String(ICON_SIZE)}"`)
    .replace(/^<svg ((?:(?!xmlns)[^>])*)>/, '<svg xmlns="http://www.w3.org/2000/svg" $1>');
}

/** Writes every file of the system except the component bundle into `out`. */
export async function assembleDesignSystem(out: string): Promise<void> {
  const tokensJson = readFileSync(
    join(root, 'packages', 'tokens', 'generated', 'design-system', 'tokens.json'),
    'utf8',
  );
  write(out, 'README.md', readFileSync(join(here, 'README.md'), 'utf8'));
  write(out, 'tokens.json', tokensJson);
  write(out, 'tokens.css', compileTokensCss(JSON.parse(tokensJson) as DsTokens, TITLE));
  fonts(out);
  write(out, 'assets/Logos/README.md', readFileSync(join(here, 'logos.md'), 'utf8'));
  for (const logo of LOGOS) {
    mkdirSync(join(out, 'assets', 'Logos'), { recursive: true });
    copyFileSync(join(logoDir, logo), join(out, 'assets', 'Logos', logo));
  }
  write(out, 'assets/Icons/README.md', readFileSync(join(here, 'icons.md'), 'utf8'));
  for (const icon of ICONS) write(out, `assets/Icons/${icon}.svg`, `${iconSvg(icon)}\n`);
  for (const icon of HEALTH_FILES) write(out, `assets/Icons/${icon}.svg`, healthSvg(icon));
  write(out, 'components/Cover/preview.html', readFileSync(join(here, 'cover.html'), 'utf8'));
  await Promise.resolve();
}
