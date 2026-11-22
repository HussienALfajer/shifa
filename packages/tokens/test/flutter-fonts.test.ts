// The Flutter font copies (slice 0.4-08): every static TTF and OFL of fonts.json, and nothing
// a crafted manifest could point at outside packages/tokens/fonts.
import { describe, expect, it } from 'vitest';
import { FLUTTER_FONTS_DIR, flutterFonts } from '../scripts/build.ts';
import { type FontFamily, loadFonts } from '../scripts/design-system.ts';

const family = (patch: Partial<FontFamily>): FontFamily => ({
  id: 'noto-naskh-arabic',
  family: 'Noto Naskh Arabic',
  licence: 'noto-naskh-arabic/OFL.txt',
  files: [{ path: 'noto-naskh-arabic/ttf/noto-naskh-arabic-400.ttf', format: 'ttf', weight: 400 }],
  ...patch,
});

describe('flutterFonts', () => {
  it('copies the six TTFs and both licences of the real manifest', () => {
    const names = Object.keys(flutterFonts(loadFonts())).map((p) =>
      p.slice(FLUTTER_FONTS_DIR.length + 1),
    );
    expect(names.sort()).toEqual([
      'ibm-plex-sans-arabic-400.ttf',
      'ibm-plex-sans-arabic-500.ttf',
      'ibm-plex-sans-arabic-600.ttf',
      'ibm-plex-sans-arabic-700.ttf',
      'ibm-plex-sans-arabic-OFL.txt',
      'noto-naskh-arabic-400.ttf',
      'noto-naskh-arabic-700.ttf',
      'noto-naskh-arabic-OFL.txt',
    ]);
  });

  it('refuses an id that is not a plain slug', () => {
    expect(() => flutterFonts([family({ id: '../../../x' })])).toThrow(/font id/);
  });

  it('refuses a TTF or licence path outside the fonts folder', () => {
    expect(() =>
      flutterFonts([
        family({
          files: [{ path: '../../../.claude/settings.local.json', format: 'ttf', weight: 400 }],
        }),
      ]),
    ).toThrow(/outside/);
    expect(() => flutterFonts([family({ licence: '../../package.json' })])).toThrow(/outside/);
  });

  it('refuses a "ttf" entry whose file is not a .ttf', () => {
    expect(() =>
      flutterFonts([
        family({ files: [{ path: 'noto-naskh-arabic/OFL.txt', format: 'ttf', weight: 400 }] }),
      ]),
    ).toThrow(/\.ttf/);
  });
});
