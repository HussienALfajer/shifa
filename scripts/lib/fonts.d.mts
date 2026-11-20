/** What the font checks read from a TTF or WOFF2 file. */
export interface FontInfo {
  codePoints: Set<number>;
  version: string;
  features: string[];
  /** The English name records by fontkit key (fontFamily, copyright, license, …). */
  names: Record<string, string> & {
    fontFamily: string;
    copyright: string;
    postscriptName: string;
    license: string;
  };
  tabularWidths: (codePoints: number[]) => number[];
}

export function readFontInfo(path: string): FontInfo;
