// WCAG 2.2 contrast (spec 0.4, criterion 3): relative luminance, contrast ratio, and the check
// of every pair declared in src/contrast-pairs.json in the light and the dark theme.
import { channels, isSrgbColor } from './color.ts';
import type { PairClass, Sources } from './sources.ts';
import { flatten, indexTokens, resolve } from './tokens.ts';

/** Body text needs 4.5 : 1 (SC 1.4.3); large text and UI marks need 3 : 1 (SC 1.4.3, 1.4.11). */
export const MINIMUM_RATIO: Record<PairClass, number> = { body: 4.5, large: 3, ui: 3 };

/** WCAG relative luminance of a six-digit hex colour: 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours: 1 to 21, whatever the order. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface ContrastFinding {
  text: string;
  surface: string;
  class: PairClass;
  theme: 'light' | 'dark';
  textHex: string;
  surfaceHex: string;
  ratio: number;
  minimum: number;
  pass: boolean;
}

/**
 * One finding per declared pair and theme. A pair the schema already rejects (unknown token or
 * class) is left out here; `checkSchema` reports it.
 */
export function checkContrast(sources: Sources): ContrastFinding[] {
  const index = indexTokens(flatten(sources));
  const findings: ContrastFinding[] = [];
  for (const pair of sources.pairs) {
    // The class comes from JSON, so it may be one the type does not know.
    const minimum = (MINIMUM_RATIO as Record<string, number | undefined>)[pair.class];
    if (minimum === undefined) continue;
    for (const theme of ['light', 'dark'] as const) {
      const mode = theme === 'dark' ? 'dark' : undefined;
      let text: unknown;
      let surface: unknown;
      try {
        text = resolve(index, pair.text, mode);
        surface = resolve(index, pair.surface, mode);
      } catch {
        continue;
      }
      if (!isSrgbColor(text) || !isSrgbColor(surface)) continue;
      const ratio = contrastRatio(text.hex, surface.hex);
      findings.push({
        ...pair,
        theme,
        textHex: text.hex,
        surfaceHex: surface.hex,
        ratio,
        minimum,
        pass: ratio >= minimum,
      });
    }
  }
  return findings;
}

/** One line per pair below its minimum; empty when every pair passes. */
export function contrastProblems(sources: Sources): string[] {
  return checkContrast(sources)
    .filter((f) => !f.pass)
    .map(
      (f) =>
        `${f.text} on ${f.surface} (${f.theme}, ${f.class}): ${f.textHex} on ${f.surfaceHex} is ${f.ratio.toFixed(1)} : 1, below ${String(f.minimum)} : 1`,
    );
}
