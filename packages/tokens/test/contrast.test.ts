// Criterion 3: WCAG 2.2 contrast for every declared pair, in light and dark.
import { describe, expect, it } from 'vitest';
import {
  checkContrast,
  contrastProblems,
  contrastRatio,
  loadSources,
  MINIMUM_RATIO,
  relativeLuminance,
} from '../src/index.ts';
import { validSources } from './fixture.ts';

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#1F6F5C', '#1F6F5C')).toBe(1);
  });

  it('does not depend on the order', () => {
    expect(contrastRatio('#FFFFFF', '#1F6F5C')).toBe(contrastRatio('#1F6F5C', '#FFFFFF'));
  });

  it('uses the WCAG relative luminance', () => {
    expect(relativeLuminance('#FFFFFF')).toBe(1);
    expect(relativeLuminance('#000000')).toBe(0);
    // sRGB mid grey #808080: ((128/255 + 0.055) / 1.055) ^ 2.4
    expect(relativeLuminance('#808080')).toBeCloseTo(0.21586, 4);
  });

  // The worked examples of docs/architecture/design-system.md, "Contrast (WCAG 2.2)".
  it.each([
    ['#1D2A26', '#FBF8F1', 14.0],
    ['#FFFFFF', '#1F6F5C', 6.0],
    ['#1F6F5C', '#FBF8F1', 5.7],
    ['#1F6F5C', '#E2F0EA', 5.1],
    ['#E8F2EE', '#134A3D', 8.9],
    ['#1D2A26', '#C8A24A', 6.2],
    ['#C8A24A', '#FFFFFF', 2.4],
    ['#C8A24A', '#134A3D', 4.2],
  ])('%s on %s is %s : 1', (text, surface, expected) => {
    expect(oneDecimal(contrastRatio(text, surface))).toBe(expected);
  });

  it('rejects a value that is not a six-digit hex colour', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow(/hex/);
  });
});

describe('minimum ratios', () => {
  it('are 4.5 for body text and 3 for large text and UI marks', () => {
    expect(MINIMUM_RATIO).toEqual({ body: 4.5, large: 3, ui: 3 });
  });
});

describe('the declared pairs', () => {
  const sources = loadSources();
  const findings = checkContrast(sources);

  it('are each checked in light and in dark', () => {
    expect(sources.pairs.length).toBeGreaterThan(20);
    expect(findings).toHaveLength(sources.pairs.length * 2);
    expect(findings.filter((f) => f.theme === 'dark')).toHaveLength(sources.pairs.length);
  });

  it('all pass', () => {
    expect(contrastProblems(sources)).toEqual([]);
    for (const f of findings) {
      expect(f.ratio, `${f.text} on ${f.surface} (${f.theme})`).toBeGreaterThanOrEqual(f.minimum);
    }
  });

  it('use the dark values in the dark theme', () => {
    const light = findings.find((f) => f.text === 'color.text.default' && f.theme === 'light');
    const dark = findings.find((f) => f.text === 'color.text.default' && f.theme === 'dark');
    expect(light?.textHex.toUpperCase()).toBe('#1D2A26');
    expect(dark?.textHex).not.toBe(light?.textHex);
    expect(dark?.surfaceHex).not.toBe(light?.surfaceHex);
  });
});

describe('a failing pair', () => {
  it('gold as body text on a white surface fails in light', () => {
    const sources = validSources();
    (sources.layers.semantic['color'] as Record<string, unknown>)['accent'] = {
      $value: '{color.gold.500}',
      $extensions: { shifa: { modes: { dark: '{color.gold.500}' } } },
    };
    sources.pairs.push({ text: 'color.accent', surface: 'color.bg.surface', class: 'body' });
    const problems = contrastProblems(sources);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/color\.accent on color\.bg\.surface.*light.*2\.4.*4\.5/);
  });

  it('the same pair passes as a UI mark only where it reaches 3 : 1', () => {
    const sources = validSources();
    (sources.layers.semantic['color'] as Record<string, unknown>)['accent'] = {
      $value: '{color.gold.500}',
      $extensions: { shifa: { modes: { dark: '{color.gold.500}' } } },
    };
    sources.pairs.push({ text: 'color.accent', surface: 'color.bg.surface', class: 'ui' });
    const findings = checkContrast(sources).filter((f) => f.text === 'color.accent');
    expect(findings.map((f) => [f.theme, f.pass])).toEqual([
      ['light', false],
      ['dark', true],
    ]);
  });

  it('the fixture itself passes', () => {
    expect(contrastProblems(validSources())).toEqual([]);
  });
});
