// The four candidate fonts (OFL) from their @fontsource packages. Each render uploads the woff2
// files with the HTML and references them with relative @font-face URLs: no web font, no CDN.
// Only the Arabic, Latin and Latin Extended subsets at weights 400 and 700 are used.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Asset } from './gotenberg.ts';

export const FONT_IDS = ['naskh', 'amiri', 'vazirmatn', 'cairo'] as const;
export type FontId = (typeof FONT_IDS)[number];

interface FontSpec {
  family: string;
  pkg: string;
  /** How the embedded font is named in `pdffonts` (subset prefix ignored). */
  pdfName: RegExp;
}

export const FONTS: Readonly<Record<FontId, FontSpec>> = {
  naskh: {
    family: 'Noto Naskh Arabic',
    pkg: '@fontsource/noto-naskh-arabic',
    pdfName: /^([A-Z]{6}\+)?NotoNaskhArabic-/,
  },
  amiri: { family: 'Amiri', pkg: '@fontsource/amiri', pdfName: /^([A-Z]{6}\+)?Amiri-/ },
  vazirmatn: {
    family: 'Vazirmatn',
    pkg: '@fontsource/vazirmatn',
    pdfName: /^([A-Z]{6}\+)?Vazirmatn-/,
  },
  cairo: { family: 'Cairo', pkg: '@fontsource/cairo', pdfName: /^([A-Z]{6}\+)?Cairo-/ },
};

/**
 * The font the goldens and checks use: Vazirmatn, the owner's choice after the eye check of the
 * font sheet (`fonts:sheet`, 2026-11-16). Noto Naskh Arabic and Amiri print well but their
 * glyph positioning breaks the PDF text layer into word fragments (report §3; ADR-0034).
 */
export const CHOSEN_FONT: FontId = 'vazirmatn';

/** The CSS family name the templates use; mapped to the chosen font's files. */
export const TEMPLATE_FAMILY = 'Shifa Arabic';

const SUBSETS = ['arabic', 'latin', 'latin-ext'];
const WEIGHTS = [400, 700];
const require = createRequire(import.meta.url);

export interface FontBundle {
  css: string;
  assets: Asset[];
}

const cache = new Map<FontId, FontBundle>();

/** @font-face rules (family renamed to TEMPLATE_FAMILY) and the woff2 files they reference. */
export function fontBundle(id: FontId): FontBundle {
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = FONTS[id];
  const root = dirname(require.resolve(`${spec.pkg}/package.json`));
  const rules: string[] = [];
  const assets = new Map<string, Asset>();
  for (const weight of WEIGHTS) {
    const css = readFileSync(join(root, `${String(weight)}.css`), 'utf8');
    for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
      const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block)?.[1];
      const subset = file?.replace(/^.*?-((?:latin-ext)|latin|arabic)-\d{3}-normal\.woff2$/, '$1');
      if (!file || !subset || !SUBSETS.includes(subset)) continue;
      const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
      rules.push(
        `@font-face{font-family:'${TEMPLATE_FAMILY}';font-style:normal;font-weight:${String(weight)};` +
          `src:url(${file}) format('woff2');${range ? `unicode-range:${range};` : ''}}`,
      );
      assets.set(file, {
        name: file,
        type: 'font/woff2',
        data: new Uint8Array(readFileSync(join(root, 'files', file))),
      });
    }
  }
  const bundle = { css: rules.join('\n'), assets: [...assets.values()] };
  cache.set(id, bundle);
  return bundle;
}

/** Package versions for the report. */
export function fontVersions(): Record<FontId, string> {
  const out = {} as Record<FontId, string>;
  for (const id of FONT_IDS) {
    const pkg = JSON.parse(
      readFileSync(require.resolve(`${FONTS[id].pkg}/package.json`), 'utf8'),
    ) as { version: string };
    out[id] = pkg.version;
  }
  return out;
}
