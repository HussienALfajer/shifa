// The document catalogue: ids, paper, thermal width, and the render inputs the tests and benches
// use. Fonts are uploaded with every render (fonts.css plus the woff2 files it names).
import type { DigitStyle } from '../digits.ts';
import { CLINIC } from '../fixtures.ts';
import { CHOSEN_FONT, type FontId, fontBundle } from '../fonts.ts';
import type { RenderInput } from '../gotenberg.ts';
import { thermalCss } from './css.ts';
import { prescription, REPORT_TITLE, type Rendered, receipt, report, ticket } from './documents.ts';

export type DocId =
  | 'prescription-a5'
  | 'receipt-80'
  | 'receipt-58'
  | 'receipt-long-58'
  | 'report-a4'
  | 'ticket-80'
  | 'ticket-58';

export interface DocumentSpec {
  id: DocId;
  /** Paper in mm; roll paper has no height (one page as tall as the content). */
  paper: { widthMm: number; heightMm?: number };
  /** Thermal printer width in dots (203 dpi): 576 for 80 mm, 384 for 58 mm. */
  thermalWidthPx?: number;
  /** Text every page must carry (repeated page header). */
  repeatedText?: string[];
}

export const DOCUMENTS: readonly DocumentSpec[] = [
  { id: 'prescription-a5', paper: { widthMm: 148, heightMm: 210 } },
  { id: 'receipt-80', paper: { widthMm: 80 }, thermalWidthPx: 576 },
  { id: 'receipt-58', paper: { widthMm: 58 }, thermalWidthPx: 384 },
  { id: 'receipt-long-58', paper: { widthMm: 58 }, thermalWidthPx: 384 },
  {
    id: 'report-a4',
    paper: { widthMm: 210, heightMm: 297 },
    repeatedText: [REPORT_TITLE, 'اسم المريض'],
  },
  { id: 'ticket-80', paper: { widthMm: 80 }, thermalWidthPx: 576 },
  { id: 'ticket-58', paper: { widthMm: 58 }, thermalWidthPx: 384 },
];

export const docSpec = (id: DocId): DocumentSpec => {
  const spec = DOCUMENTS.find((d) => d.id === id);
  if (!spec) throw new Error(`unknown document ${id}`);
  return spec;
};

function build(id: DocId, digits: DigitStyle): Rendered {
  switch (id) {
    case 'prescription-a5':
      return prescription(digits);
    case 'receipt-80':
      return receipt(digits, 80);
    case 'receipt-58':
      return receipt(digits, 58);
    case 'receipt-long-58':
      return receipt(digits, 58, true);
    case 'report-a4':
      return report(digits);
    case 'ticket-80':
      return ticket(digits, 80);
    case 'ticket-58':
      return ticket(digits, 58);
  }
}

export function renderInput(
  id: DocId,
  digits: DigitStyle,
  font: FontId = CHOSEN_FONT,
): RenderInput {
  const bundle = fontBundle(font);
  const spec = docSpec(id);
  return {
    doc: id,
    html: build(id, digits).html,
    assets: [
      { name: 'fonts.css', type: 'text/css', data: new TextEncoder().encode(bundle.css) },
      ...bundle.assets,
    ],
    ...(spec.paper.heightMm === undefined ? { roll: { widthMm: spec.paper.widthMm } } : {}),
  };
}

/** The same page for a thermal raster: CSS mm scaled to printer dots. */
export function renderThermalInput(
  id: DocId,
  digits: DigitStyle,
  font: FontId = CHOSEN_FONT,
): RenderInput {
  const input = renderInput(id, digits, font);
  return { ...input, html: input.html.replace('</head>', `<style>${thermalCss}</style></head>`) };
}

export function expectedText(id: DocId, digits: DigitStyle): string[] {
  return build(id, digits).expected;
}

export { CLINIC };
