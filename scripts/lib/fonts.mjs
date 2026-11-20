// Reads what the font checks need from a TTF or WOFF2 file: the code points it covers, its
// version and the laid-out width of characters with tabular figures requested.
import { readFileSync } from 'node:fs';
import * as fontkit from 'fontkit';

/**
 * @param {string} path
 * @returns {{
 *   codePoints: Set<number>,
 *   version: string,
 *   features: string[],
 *   tabularWidths: (codePoints: number[]) => number[],
 * }}
 */
export const readFontInfo = (path) => {
  const font = fontkit.create(readFileSync(path));
  const features = font.availableFeatures;
  const requested = features.includes('tnum') ? ['tnum'] : [];
  return {
    codePoints: new Set(font.characterSet),
    version: String(font.version).replace(/^Version\s+/i, ''),
    features,
    // The English name records by fontkit key (fontFamily, copyright, license, …).
    names: Object.fromEntries(
      Object.entries(font.name?.records ?? {})
        .filter(([, value]) => typeof value?.en === 'string')
        .map(([key, value]) => [key, value.en]),
    ),
    // Width in font units of each character set alone, as a table cell would set a digit.
    tabularWidths: (codePoints) =>
      codePoints.map((cp) => font.layout(String.fromCodePoint(cp), requested).advanceWidth),
  };
};
