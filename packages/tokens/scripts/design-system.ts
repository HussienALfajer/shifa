// The fourth output of the tokens build: the Shifa Design System's tokens file, in the Design
// System artifact type's own list format (not DTCG). Each token keeps its CSS custom property
// name, so a drawing made with the design system ports to code as it is. Semantic, brand and
// component colours are aliases of the token they follow, per theme; the usage note of every
// token is its `$description` (or its group's). Densities: the comfortable value is shown and the
// compact one is named in the note. Motion has no family in that format and is left out.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  channels,
  type FlatToken,
  indexTokens,
  type Mode,
  referenceOf,
  resolve,
  type SrgbColor,
  valueIn,
} from '../src/index.ts';
import type { BuiltToken } from './build.ts';
import { HEADER } from './formats.ts';
import { cssValue } from './values.ts';

/** One family entry of the list format. */
export interface DsToken {
  name: string;
  value: string | { light: string; dark: string };
  usage: string;
}

export interface DsTypeStyle {
  name: string;
  family?: string;
  fontSize: string;
  lineHeight: number;
  fontWeight: number;
  usage: string;
}

export interface DsFont {
  family: string;
  file: string;
  weight: string;
  style: 'normal';
}

export interface DesignSystemTokens {
  name: string;
  version: number;
  meta: { source: 'code'; generated: string; package: string };
  color: { themes: { id: string; name: string }[]; tokens: DsToken[] };
  type: {
    fonts: DsFont[];
    families: Record<string, string>;
    groups: { name: string; family: string; styles: DsTypeStyle[] }[];
  };
  spacing: { tokens: DsToken[] };
  radius: { tokens: DsToken[] };
  shadow: { tokens: DsToken[] };
  size: { tokens: DsToken[] };
  zIndex: { tokens: DsToken[] };
}

/** One family of packages/tokens/fonts/fonts.json. */
export interface FontFamily {
  /** `ibm-plex-sans-arabic`: the folder under `fonts/`. */
  id?: string;
  family: string;
  /** The family's `OFL.txt`, relative to `fonts/`. */
  licence?: string;
  /** The family name the CSS uses (OD-59: IBM Plex Sans Arabic is served as Shifa Sans Arabic). */
  webFamily?: string;
  files: { path: string; format: string; weight: number }[];
}

export const FONTS_DIR = join(import.meta.dirname, '..', 'fonts');

/** The self-hosted families of `fonts/fonts.json`. */
export function loadFonts(dir: string = FONTS_DIR): FontFamily[] {
  const manifest = JSON.parse(readFileSync(join(dir, 'fonts.json'), 'utf8')) as {
    families: FontFamily[];
  };
  return manifest.families;
}

interface Unit {
  value: number;
  unit: string;
}

const REM_PX = 16;
const px = ({ value, unit }: Unit) => `${String(unit === 'rem' ? value * REM_PX : value)}px`;
const byte = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** `#rrggbb`, or `#rrggbbaa` when translucent (or always, for shadow colours). */
function hex(color: SrgbColor, withAlpha = false): string {
  const alpha = color.alpha ?? 1;
  const base = `#${channels(color.hex).map(byte).join('')}`;
  return alpha < 1 || withAlpha ? base + byte(alpha * 255) : base;
}

function shadow(value: unknown): string {
  const layers = (Array.isArray(value) ? value : [value]) as {
    color: SrgbColor;
    offsetX: Unit;
    offsetY: Unit;
    blur: Unit;
    spread: Unit;
  }[];
  return layers
    .map(
      (s) => [s.offsetX, s.offsetY, s.blur, s.spread].map(px).join(' ') + ` ${hex(s.color, true)}`,
    )
    .join(', ');
}

/** What the leaf name of a locked (status-like) colour does; appended to its family's note. */
const ROLES: Record<string, string> = {
  fg: 'Text and icons, on its bg or on a surface.',
  bg: 'The soft fill.',
  border: 'Border of the soft fill.',
  solid: 'A solid fill: badges, dots, bars.',
  'on-solid': 'Text and icons on the solid fill.',
};

const GROUP_NAMES: Record<string, string> = {
  title: 'Titles',
  label: 'Labels',
  paragraph: 'Paragraphs',
};

type Family = 'spacing' | 'radius' | 'shadow' | 'size' | 'zIndex';

/** The list a non-colour token goes in, or null when the format has no place for it. */
function familyOf(token: FlatToken): Family | null {
  const { path, type } = token;
  if (type === 'shadow') return 'shadow';
  if (type === 'number') return path.startsWith('z.') ? 'zIndex' : null;
  if (type !== 'dimension' || path.startsWith('font.') || path.startsWith('text.')) return null;
  if (path.includes('radius')) return 'radius';
  if (/^(space|inset|gap)\./.test(path) || path.endsWith('padding') || path.includes('.padding-')) {
    return 'spacing';
  }
  return 'size';
}

export function designSystem(
  tokens: FlatToken[],
  css: BuiltToken[],
  fonts: FontFamily[],
): DesignSystemTokens {
  const index = indexTokens(tokens);
  const nameOf = new Map(css.map((t) => [t.path, t.name]));
  const name = (path: string) => {
    const found = nameOf.get(path);
    if (found === undefined) throw new Error(`${path}: no CSS name`);
    return found;
  };
  const literal = (token: FlatToken, mode?: Mode): string => {
    const value = resolve(index, token.path, mode);
    if (token.type === 'color') return hex(value as SrgbColor);
    if (token.type === 'shadow') return shadow(value);
    if (token.type === 'dimension') return px(value as Unit);
    return String(value);
  };
  const alias = (token: FlatToken, mode?: Mode) => {
    const target = referenceOf(valueIn(token, mode));
    return target === null ? literal(token, mode) : `{${name(target)}}`;
  };

  const usage = (token: FlatToken): string => {
    const target = referenceOf(token.value);
    const parts: string[] = [];
    // A component token says what it follows: its file-level note is about the layer, not it.
    if (token.layer === 'component' && target !== null) parts.push(`Follows ${name(target)}.`);
    else if (token.description !== undefined) parts.push(token.description);
    else parts.push('A palette or scale step: draw with the tokens that point here.');
    if (token.locked) {
      const role = ROLES[token.path.slice(token.path.lastIndexOf('.') + 1)];
      if (role !== undefined) parts.push(role);
      parts.push('Locked: no clinic theme changes it.');
    }
    if (token.modes['compact'] !== undefined) parts.push(`Compact: ${literal(token, 'compact')}.`);
    return parts.join(' ').slice(0, 1000);
  };

  const colours: DsToken[] = tokens
    .filter((t) => t.type === 'color')
    .map((t) => ({
      name: name(t.path),
      value:
        t.layer === 'primitive'
          ? literal(t)
          : t.modes['dark'] === undefined
            ? alias(t)
            : { light: alias(t), dark: alias(t, 'dark') },
      usage: usage(t),
    }));

  const lists: Record<Family, DsToken[]> = {
    spacing: [],
    radius: [],
    shadow: [],
    size: [],
    zIndex: [],
  };
  for (const token of tokens) {
    const family = familyOf(token);
    if (family !== null)
      lists[family].push({ name: name(token.path), value: literal(token), usage: usage(token) });
  }

  const families: Record<string, string> = {};
  for (const token of tokens.filter((t) => t.path.startsWith('font.family.'))) {
    families[token.path.slice('font.family.'.length)] = cssValue('fontFamily', token.value);
  }

  const groups: DesignSystemTokens['type']['groups'] = [];
  for (const token of tokens.filter((t) => /^text\.style\.[\w-]+\.[\w-]+\.size$/.test(t.path))) {
    const [, , group = '', style = ''] = token.path.split('.');
    const part = (key: string) => {
      const found = index.get(`text.style.${group}.${style}.${key}`);
      if (found === undefined) throw new Error(`text.style.${group}.${style} has no ${key}`);
      return found;
    };
    const familyRef = referenceOf(part('family').value) ?? '';
    const family = familyRef.slice('font.family.'.length);
    let entry = groups.find((g) => g.name === (GROUP_NAMES[group] ?? group));
    if (entry === undefined) {
      entry = { name: GROUP_NAMES[group] ?? group, family, styles: [] };
      groups.push(entry);
    }
    entry.styles.push({
      name: `${group}-${style}`,
      ...(family === entry.family ? {} : { family }),
      fontSize: literal(token),
      lineHeight: Number(literal(part('leading'))),
      fontWeight: Number(literal(part('weight'))),
      usage: usage(token),
    });
  }

  const files: DsFont[] = fonts.flatMap((f) =>
    f.files
      .filter((file) => file.format === 'ttf')
      .map((file) => ({
        family: f.webFamily ?? f.family,
        file: `fonts/${basename(file.path)}`,
        weight: String(file.weight),
        style: 'normal' as const,
      })),
  );

  return {
    name: 'Shifa',
    version: 1,
    meta: { source: 'code', generated: HEADER, package: 'packages/tokens' },
    color: {
      themes: [
        { id: 'light', name: 'Light' },
        { id: 'dark', name: 'Dark' },
      ],
      tokens: colours,
    },
    type: { fonts: files, families, groups },
    spacing: { tokens: lists.spacing },
    radius: { tokens: lists.radius },
    shadow: { tokens: lists.shadow },
    size: { tokens: lists.size },
    zIndex: { tokens: lists.zIndex },
  };
}
