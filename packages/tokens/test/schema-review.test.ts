// Schema rules added after the 0.4-01 review: gaps a token could slip through.
import { describe, expect, it } from 'vitest';
import { checkSchema, contrastProblems, type Sources, srgb } from '../src/index.ts';
import { validSources } from './fixture.ts';

function broken(change: (sources: Sources) => void): string[] {
  const sources = validSources();
  change(sources);
  return checkSchema(sources);
}

const group = (value: unknown) => value as Record<string, Record<string, unknown>>;
const dark = (ref: string) => ({ shifa: { modes: { dark: ref } } });

describe('translucent colours', () => {
  function withGhost(sources: Sources): void {
    group(sources.layers.primitive['color'])['ghost'] = { 10: { $value: srgb('#1D2A26', 0.1) } };
    group(sources.layers.semantic['color'])['text'] = {
      ...group(sources.layers.semantic['color'])['text'],
      ghost: { $value: '{color.ghost.10}', $extensions: dark('{color.ghost.10}') },
    };
    sources.pairs.push({ text: 'color.text.ghost', surface: 'color.bg.surface', class: 'body' });
  }

  it('a pair with a translucent text colour fails instead of passing as opaque', () => {
    expect(broken(withGhost).join('\n')).toMatch(/color\.text\.ghost has an alpha below 1/);
  });

  it('the contrast check alone would have passed it in light', () => {
    const sources = validSources();
    withGhost(sources);
    expect(contrastProblems(sources).filter((p) => p.includes('light'))).toEqual([]);
  });

  it('a translucent surface fails too', () => {
    const problems = broken((s) => {
      group(s.layers.primitive['color'])['veil'] = { 50: { $value: srgb('#FFFFFF', 0.5) } };
      group(s.layers.semantic['color'])['bg'] = {
        ...group(s.layers.semantic['color'])['bg'],
        veil: { $value: '{color.veil.50}', $extensions: dark('{color.veil.50}') },
      };
      s.pairs.push({ text: 'color.text.default', surface: 'color.bg.veil', class: 'body' });
    });
    expect(problems.join('\n')).toMatch(/color\.bg\.veil has an alpha below 1/);
  });
});

describe('a token inside a token', () => {
  it('fails instead of vanishing from the outputs', () => {
    const problems = broken((s) => {
      const text = group(s.layers.semantic['color'])['text'] ?? {};
      text['default'] = {
        ...(text['default'] as object),
        inverse: { $value: '{color.white}', $extensions: dark('{color.night.900}') },
      };
      s.pairs.push({
        text: 'color.text.default.inverse',
        surface: 'color.brand.primary',
        class: 'body',
      });
    });
    expect(problems.join('\n')).toMatch(
      /color\.text\.default\.inverse: is inside the token color\.text\.default/,
    );
  });
});

describe('hue rules', () => {
  function withCrimson(sources: Sources): void {
    group(sources.layers.primitive['color'])['signal'] = {
      crimson: { 700: { $value: srgb('#C01B37') }, 300: { $value: srgb('#DF8190') } },
      green: { 700: { $value: srgb('#1D744C') }, 300: { $value: srgb('#42BB82') } },
    };
  }
  const locked = (light: string, darkRef: string) => ({
    $value: light,
    $extensions: { shifa: { locked: true, modes: { dark: darkRef } } },
  });

  it('crimson outside color.alert.critical fails', () => {
    const problems = broken((s) => {
      withCrimson(s);
      group(s.layers.semantic['color'])['status'] = {
        success: { fg: locked('{color.signal.crimson.700}', '{color.signal.green.300}') },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.status\.success\.fg: crimson/);
  });

  it('crimson in a dark value fails too, and in a brand slot', () => {
    const problems = broken((s) => {
      withCrimson(s);
      group(s.layers.brand['color'])['brand'] = {
        ...group(s.layers.brand['color'])['brand'],
        primary: { $value: '{color.green.600}', $extensions: dark('{color.signal.crimson.300}') },
      };
    });
    expect(problems.join('\n')).toMatch(/color\.brand\.primary: crimson/);
  });

  it('crimson under color.alert.critical passes', () => {
    const problems = broken((s) => {
      withCrimson(s);
      group(s.layers.semantic['color'])['alert'] = {
        critical: { fg: locked('{color.signal.crimson.700}', '{color.signal.crimson.300}') },
      };
      s.pairs.push({ text: 'color.alert.critical.fg', surface: 'color.bg.surface', class: 'body' });
    });
    expect(problems.filter((p) => p.includes('color.alert'))).toEqual([]);
  });
});
