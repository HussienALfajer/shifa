// The vendored Solar icons (OD-65, slice 0.4-09): what scripts/icons-sync.ts writes and what
// test/icons-vendored.test.ts checks against. Every file is derived from @iconify-json/solar
// (Solar by 480 Design, CC BY 4.0), the Broken style: the web SVG files of src/icons/solar/ and
// the Dart painters of shifa_ui's base-widget glyphs (no SVG parser in Flutter's widgets layer).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { FLUTTER_GLYPHS, SOLAR, type SolarSource } from '../src/icons/sources.ts';

interface IconifySet {
  icons: Record<string, { body: string }>;
  width?: number;
  height?: number;
}

const require = createRequire(import.meta.url);
const set = require('@iconify-json/solar/icons.json') as IconifySet;
const pkg = require('@iconify-json/solar/package.json') as { version: string };

export const SOLAR_VERSION = pkg.version;
const here = import.meta.dirname;
export const SOLAR_DIR = join(here, '..', 'src', 'icons', 'solar');
export const DART_FILE = join(
  here,
  '..',
  '..',
  'shifa_ui',
  'lib',
  'src',
  'generated',
  'glyphs.g.dart',
);

/** The Broken body of a Solar icon; throws for a name Solar does not have. */
export function solarBody(name: string): string {
  const icon = set.icons[`${name}-broken`];
  if (icon === undefined) throw new Error(`icons: Solar has no "${name}-broken"`);
  if ((set.width ?? 24) !== 24 || (set.height ?? 24) !== 24) throw new Error('icons: not 24 px');
  return icon.body;
}

/** One vendored SVG file: Solar's body on its 24 grid, flipped when the source says so. */
export function solarSvg(source: SolarSource): string {
  const body = solarBody(source.solar);
  const drawn = source.mirror ? `<g transform="matrix(-1 0 0 1 24 0)">${body}</g>` : body;
  const note = `Solar ${source.solar}-broken by 480 Design, CC BY 4.0${source.mirror ? ', mirrored' : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><!-- ${note} -->${drawn}</svg>\n`;
}

/** Every web file by its name in src/icons/solar/. */
export function solarFiles(): Map<string, string> {
  return new Map(Object.entries(SOLAR).map(([name, source]) => [`${name}.svg`, solarSvg(source)]));
}

// --- Dart -------------------------------------------------------------------------------------

type Attrs = Record<string, string>;
const attrsOf = (tag: string): Attrs =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m): [string, string] => [m[1] ?? '', m[2] ?? '']),
  );

const num = (n: number) => String(Number(n.toFixed(5)));

/** Dart cascade calls drawing one SVG path (absolute M L H V C Z only, as Solar writes them). */
function dartPath(d: string): string {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const calls: string[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i] ?? '';
    if (/[A-Za-z]/.test(t)) {
      if (!'MLHVCZ'.includes(t)) throw new Error(`icons: path command "${t}" not handled`);
      cmd = t;
      i++;
      if (cmd === 'Z') {
        calls.push('..close()');
        continue;
      }
    }
    if (cmd === 'M' || cmd === 'L') {
      x = next();
      y = next();
      calls.push(`..${cmd === 'M' ? 'moveTo' : 'lineTo'}(${num(x)}, ${num(y)})`);
      if (cmd === 'M') cmd = 'L';
    } else if (cmd === 'H') {
      x = next();
      calls.push(`..lineTo(${num(x)}, ${num(y)})`);
    } else if (cmd === 'V') {
      y = next();
      calls.push(`..lineTo(${num(x)}, ${num(y)})`);
    } else if (cmd === 'C') {
      const c = [next(), next(), next(), next(), next(), next()];
      x = c[4] ?? 0;
      y = c[5] ?? 0;
      calls.push(`..cubicTo(${c.map(num).join(', ')})`);
    } else {
      throw new Error(`icons: number without a command in "${d}"`);
    }
  }
  return calls.join('');
}

/** The draw calls of one Solar body, each with its paint (round or miter joins). */
function dartDraws(name: string): string[] {
  const body = solarBody(name);
  const group = attrsOf(/^<g ([^>]*)>/.exec(body)?.[1] ?? '');
  const draws: string[] = [];
  for (const m of body.matchAll(/<(path|circle) ([^>]*)\/>/g)) {
    const a = { ...group, ...attrsOf(m[2] ?? '') };
    if (a['stroke-width'] !== '1.5' || a['stroke-linecap'] !== 'round' || a['fill'] !== 'none') {
      throw new Error(`icons: ${name} is not a 1.5 round stroke with no fill`);
    }
    const paint = a['stroke-linejoin'] === 'round' ? 'round' : 'miter';
    if (m[1] === 'circle') {
      const [cx, cy, r] = [a['cx'], a['cy'], a['r']].map((v) => num(Number(v)));
      draws.push(`..drawCircle(const Offset(${cx ?? ''}, ${cy ?? ''}), ${r ?? ''}, ${paint})`);
    } else {
      draws.push(`..drawPath(Path()${dartPath(a['d'] ?? '')}, ${paint})`);
    }
  }
  if (draws.length === 0) throw new Error(`icons: ${name} draws nothing`);
  return draws;
}

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** glyphs.g.dart: one painter per base-widget glyph, on Solar's 24 grid. */
export function dartGlyphs(): string {
  const painters = Object.entries(FLUTTER_GLYPHS).map(
    ([dart, solar]) =>
      `/// Solar ${solar}-broken.\nvoid paint${pascal(dart)}(Canvas c, Paint miter, Paint round) {\n  c${dartDraws(solar).join('\n    ')};\n}\n`,
  );
  return [
    `// Generated by packages/ui/scripts/icons-sync.ts from @iconify-json/solar ${SOLAR_VERSION}. Do not edit.`,
    '// Solar by 480 Design, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), Broken style.',
    '// Paths on a 24 × 24 grid, stroked 1.5 wide with round caps; `round` joins where Solar sets them.',
    '// ignore_for_file: type=lint',
    "import 'dart:ui';",
    '',
    painters.join('\n'),
  ].join('\n');
}
