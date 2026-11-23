// Slice 0.4-09 (OD-65): the vendored Solar icons are exactly what @iconify-json/solar gives for
// the map in src/icons/sources.ts (web files and Flutter painters), so a hand edit or a stale
// file after a map or version change fails here; `pnpm --filter @shifa/ui icons:sync` rewrites
// them. The licence notes travel with the files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DART_FILE,
  dartGlyphs,
  SOLAR_DIR,
  SOLAR_VERSION,
  solarBody,
  solarFiles,
} from '../scripts/icons.ts';
import { FLUTTER_GLYPHS, HEALTHICONS, SOLAR } from '../src/icons/sources.ts';

const healthDir = join(import.meta.dirname, '..', 'src', 'icons', 'health');
const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
) as { devDependencies: Record<string, string>; dependencies: Record<string, string> };

describe('vendored Solar icons', () => {
  it('pins @iconify-json/solar exactly, as a dev dependency only', () => {
    expect(manifest.devDependencies['@iconify-json/solar']).toBe(SOLAR_VERSION);
    expect(manifest.dependencies['@iconify-json/solar']).toBeUndefined();
  });

  it('holds exactly one file per mapped name, each as the sync writes it', () => {
    const want = solarFiles();
    const svgs = readdirSync(SOLAR_DIR).filter((f) => f.endsWith('.svg'));
    expect(svgs.sort()).toEqual([...want.keys()].sort());
    for (const [file, svg] of want) {
      expect(readFileSync(join(SOLAR_DIR, file), 'utf8'), file).toBe(svg);
    }
  });

  it('uses the Broken style only, and flips sign-out to point to the end', () => {
    for (const [name, source] of Object.entries(SOLAR)) {
      expect(() => solarBody(source.solar), name).not.toThrow();
    }
    expect(readFileSync(join(SOLAR_DIR, 'sign-out.svg'), 'utf8')).toMatch(
      /matrix\(-1 0 0 1 24 0\)/,
    );
  });

  it('writes the Flutter painters from the same set', () => {
    expect(readFileSync(DART_FILE, 'utf8')).toBe(dartGlyphs());
    for (const solar of Object.values(FLUTTER_GLYPHS)) {
      expect(() => solarBody(solar), solar).not.toThrow();
    }
  });

  it('keeps the licence notes beside the files', () => {
    const solar = readFileSync(join(SOLAR_DIR, 'LICENSE.md'), 'utf8');
    expect(solar).toMatch(/480 Design/);
    expect(solar).toMatch(/CC BY 4\.0/);
    expect(solar).toMatch(/About/);
    for (const name of HEALTHICONS) expect(existsSync(join(healthDir, `${name}.svg`))).toBe(true);
    expect(readFileSync(join(healthDir, 'LICENSE.md'), 'utf8')).toMatch(/CC0/);
  });
});
