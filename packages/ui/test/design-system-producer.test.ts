// Spec 0.4 criterion 12 (slice 0.4-03, backlog "Design-system sync is assembled by hand"): one
// command rebuilds what the Shifa Design System holds from the repository: the brand-book README,
// tokens.json equal to the generated token output, a compiled tokens.css, the six static fonts
// (Plex renamed, OD-59), the logo files, an Icons group and the cover, and nothing else
// outside the component bundle (design-system-bundle.test.ts).
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFontInfo } from '../../../scripts/lib/fonts.mjs';
import { assembleDesignSystem } from '../scripts/design-system/assemble.ts';

const root = join(import.meta.dirname, '..', '..', '..');
const generated = join(root, 'packages', 'tokens', 'generated', 'design-system', 'tokens.json');
const logoDir = join(root, 'docs', 'brand', 'logo');

let out: string;
const listTree = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listTree(join(dir, e.name))
      : [relative(out, join(dir, e.name)).replaceAll('\\', '/')],
  );
const read = (path: string) => readFileSync(join(out, path), 'utf8');
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'shifa-ds-'));
  await assembleDesignSystem(out);
});
afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

const LOGOS = [
  'favicon.svg',
  'shifa-app-icon.svg',
  ...['horizontal', 'stacked'].flatMap((form) =>
    ['color', 'mono', 'reverse', 'white'].map((ink) => `shifa-logo-${form}-${ink}.svg`),
  ),
  ...['color', 'mono', 'reverse', 'white'].map((ink) => `shifa-mark-${ink}.svg`),
];

describe('design-system producer', () => {
  it('writes exactly the brand book, tokens, fonts, logos, icons and cover', () => {
    const files = listTree(out);
    const icons = files.filter((f) => f.startsWith('assets/Icons/') && f.endsWith('.svg'));
    const expected = [
      'README.md',
      'tokens.json',
      'tokens.css',
      'components/Cover/preview.html',
      'assets/Logos/README.md',
      ...LOGOS.map((f) => `assets/Logos/${f}`),
      'assets/Icons/README.md',
      ...icons,
      ...[400, 500, 600, 700].map((w) => `fonts/ibm-plex-sans-arabic-${String(w)}.ttf`),
      ...[400, 700].map((w) => `fonts/noto-naskh-arabic-${String(w)}.ttf`),
    ];
    expect(files.sort()).toEqual(expected.sort());
  });

  it('copies tokens.json byte for byte from the generated token output', () => {
    expect(read('tokens.json')).toBe(readFileSync(generated, 'utf8'));
  });

  it('compiles tokens.css from tokens.json: themes, aliases, scales, type styles, fonts', () => {
    const css = read('tokens.css');
    expect(css.split('\n')[0]).toBe('/* Shifa Design System — generated from tokens.json */');
    expect(css).toContain(':root, [data-theme="light"] {');
    expect(css).toContain('--shifa-color-bg-app: var(--shifa-color-jasmine-cream-50);');
    const dark = css.slice(css.indexOf('[data-theme="dark"] {'));
    expect(dark).toContain('--shifa-color-bg-app: var(--shifa-color-jasmine-night-950);');
    // An alias is declared again in dark, so it follows the token it points at there.
    expect(dark).toContain('--shifa-button-primary-bg: var(--shifa-color-brand-primary);');
    expect(css).toMatch(/:root \{\n {2}--shifa-space-0: 0px;/);
    expect(css).toContain("--font-sans: 'Shifa Sans Arabic', system-ui, sans-serif;");
    expect(css).toMatch(/\.title-display \{ font-family: var\(--font-sans\); font-size: 44px;/);
    const faces = css.match(/@font-face \{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(6);
    expect(faces.filter((f) => f.includes("'Shifa Sans Arabic'"))).toHaveLength(4);
    expect(css).not.toMatch(/Plex/);
  });

  it('lists every font file in tokens.json, and the UI fonts carry no "Plex" in their names', () => {
    const tokens = JSON.parse(read('tokens.json')) as { type: { fonts: { file: string }[] } };
    const listed = tokens.type.fonts.map((f) => f.file).sort();
    expect(
      listTree(out)
        .filter((f) => f.startsWith('fonts/'))
        .sort(),
    ).toEqual(listed);
    for (const w of [400, 500, 600, 700]) {
      const { names } = readFontInfo(join(out, 'fonts', `ibm-plex-sans-arabic-${String(w)}.ttf`));
      expect(names.fontFamily).toBe('Shifa Sans Arabic');
      expect(Object.values(names).filter((v) => /plex/i.test(v))).toEqual([]);
      expect(names.copyright).toMatch(/IBM Corp/);
    }
  });

  it('copies the logo files unchanged from docs/brand/logo', () => {
    for (const file of LOGOS) {
      expect(sha(join(out, 'assets', 'Logos', file)), file).toBe(sha(join(logoDir, file)));
    }
  });

  it('draws a representative icon set from Tabler, outline in the near-black ink (OD-65)', () => {
    const icons = listTree(out).filter((f) => f.startsWith('assets/Icons/') && f.endsWith('.svg'));
    expect(icons.length).toBeGreaterThanOrEqual(12);
    expect(icons).toContain('assets/Icons/calendar-plus.svg');
    expect(icons).toContain('assets/Icons/tooth.svg');
    for (const icon of icons) {
      const svg = read(icon);
      expect(svg, icon).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(svg, icon).toMatch(/class="tabler-icon /);
      expect(svg, icon).toMatch(/fill="none"/);
      expect(svg, icon).toMatch(/stroke="#1d2a26"/i);
      expect(svg, icon).not.toMatch(/currentColor|opacity=/);
    }
    const readme = read('assets/Icons/README.md');
    expect(readme).toMatch(/#1d2a26/i);
    expect(readme).toMatch(/Tabler/);
    expect(readme).not.toMatch(/Phosphor|Healthicons|duotone/i);
  });

  it('writes the brand book and the cover from their sources', () => {
    expect(read('README.md')).toMatch(/^# Shifa Design System/);
    expect(read('README.md')).toContain('Shifa Sans Arabic');
    expect(read('components/Cover/preview.html').split('\n')[0]).toMatch(/^<!-- @dsCard /);
  });
});
