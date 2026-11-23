// Slice 0.4-09 (OD-65): the vendored icons are exactly what @iconify-json/solar (and the
// Healthicons tooth file) give for the map in src/icons/sources.ts, as a web module and as
// Flutter painters, so a hand edit or a stale output after a map or version change fails here;
// `pnpm --filter @shifa/ui icons:sync` rewrites them. The licence notes travel with them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DART_FILE,
  dartGlyphs,
  dartPath,
  iconModule,
  MODULE_FILE,
  SOLAR_VERSION,
  solarBody,
} from '../scripts/icons.ts';
import { FLUTTER_GLYPHS, HEALTHICONS, SOLAR } from '../src/icons/sources.ts';

const iconsDir = join(import.meta.dirname, '..', 'src', 'icons');
const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
) as { devDependencies: Record<string, string>; dependencies: Record<string, string> };

/** The mean x of a path's points: below 12 it sits on the start side of the 24 grid. */
const meanX = (d: string) => {
  const xs = [...d.matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => Number(m[1]));
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};

describe('vendored icons', () => {
  it('pins @iconify-json/solar exactly, as a dev dependency only', () => {
    expect(manifest.devDependencies['@iconify-json/solar']).toBe(SOLAR_VERSION);
    expect(manifest.dependencies['@iconify-json/solar']).toBeUndefined();
  });

  it('writes the web module as the sync does, one entry per curated name', () => {
    expect(readFileSync(MODULE_FILE, 'utf8')).toBe(iconModule());
    for (const name of [...Object.keys(SOLAR), ...HEALTHICONS]) {
      expect(iconModule()).toContain(`${JSON.stringify(name)}:`);
    }
  });

  it('uses the Broken style only', () => {
    for (const [name, source] of Object.entries(SOLAR)) {
      expect(() => solarBody(source.solar), name).not.toThrow();
    }
  });

  it('flips sign-out because Solar draws its arrow toward the start', () => {
    expect(SOLAR['sign-out'].mirror).toBe(true);
    const arrow = /<path stroke-linejoin="round" d="([^"]+)"/.exec(solarBody('logout-2'))?.[1];
    expect(arrow).toBeDefined();
    // Before the flip the arrow sits on the start side; after it, on the end side.
    expect(meanX(arrow ?? '')).toBeLessThan(12);
    expect(24 - meanX(arrow ?? '')).toBeGreaterThan(12);
    for (const [name, source] of Object.entries(SOLAR)) {
      if (name !== 'sign-out') expect(source.mirror, name).toBeUndefined();
    }
  });

  it('writes the Flutter painters from the same set', () => {
    expect(readFileSync(DART_FILE, 'utf8')).toBe(dartGlyphs());
    for (const solar of Object.values(FLUTTER_GLYPHS)) {
      expect(() => solarBody(solar), solar).not.toThrow();
    }
  });

  it('keeps the licence notes beside the sources', () => {
    const solar = readFileSync(join(iconsDir, 'solar', 'LICENSE.md'), 'utf8');
    expect(solar).toMatch(/480 Design/);
    expect(solar).toMatch(/CC BY 4\.0/);
    expect(solar).toMatch(/About/);
    for (const name of HEALTHICONS) {
      expect(existsSync(join(iconsDir, 'health', `${name}.svg`))).toBe(true);
    }
    expect(readFileSync(join(iconsDir, 'health', 'LICENSE.md'), 'utf8')).toMatch(/CC0/);
  });
});

describe('SVG path to Dart', () => {
  it.each([
    ['M1 2L3 4', '..moveTo(1, 2)..lineTo(3, 4)'],
    ['M1 2 3 4 5 6', '..moveTo(1, 2)..lineTo(3, 4)..lineTo(5, 6)'],
    ['M1 2H5V7H2', '..moveTo(1, 2)..lineTo(5, 2)..lineTo(5, 7)..lineTo(2, 7)'],
    ['M0 0C1 2 3 4 5 6V9', '..moveTo(0, 0)..cubicTo(1, 2, 3, 4, 5, 6)..lineTo(5, 9)'],
    ['M2 3L8 3Z H5', '..moveTo(2, 3)..lineTo(8, 3)..close()..lineTo(5, 3)'],
    ['M.5 -1.25L1e1 0', '..moveTo(0.5, -1.25)..lineTo(10, 0)'],
  ])('%s', (d, dart) => {
    expect(dartPath(d)).toBe(dart);
  });

  it('refuses commands it does not draw', () => {
    expect(() => dartPath('M0 0A1 1 0 0 1 2 2')).toThrow(/"A"/);
    expect(() => dartPath('m0 0l1 1')).toThrow(/"m"/);
  });
});
