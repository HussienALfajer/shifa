// Criteria 2–3: every document in both digit styles comes out of Gotenberg with its Arabic in
// logical order, Latin runs intact, only embedded uploaded fonts and the right page size.
import { beforeAll, describe, expect, it } from 'vitest';
import { DIGIT_STYLES, type DigitStyle } from '../src/digits.ts';
import { CHOSEN_FONT, FONTS } from '../src/fonts.ts';
import type { PdfPage } from '../src/pdf-tools.ts';
import { DOCUMENTS, type DocumentSpec, expectedText, renderInput } from '../src/templates/index.ts';
import { squash, useStack } from './stack.ts';

const stack = useStack();
const MM = 72 / 25.4;
/** Arabic presentation forms: a sign of visual-order or unshaped text in the extraction. */
const PRESENTATION_FORMS = /[\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}]/u;

interface Rendered {
  text: string;
  pageTexts: string[];
  pages: PdfPage[];
  fonts: { name: string; embedded: boolean }[];
}
const rendered = new Map<string, Rendered>();
const key = (doc: DocumentSpec, digits: DigitStyle) => `${doc.id}/${digits}`;

beforeAll(async () => {
  for (const doc of DOCUMENTS) {
    for (const digits of DIGIT_STYLES) {
      const pdf = await stack.gotenberg.renderPdf(renderInput(doc.id, digits));
      const pages = await stack.pdf.info(pdf);
      const pageTexts: string[] = [];
      for (let n = 1; n <= pages.length; n += 1) pageTexts.push(await stack.pdf.text(pdf, n));
      rendered.set(key(doc, digits), {
        text: await stack.pdf.text(pdf),
        pageTexts,
        pages,
        fonts: await stack.pdf.fonts(pdf),
      });
    }
  }
});

const get = (doc: DocumentSpec, digits: DigitStyle): Rendered => {
  const r = rendered.get(key(doc, digits));
  if (!r) throw new Error(`not rendered: ${key(doc, digits)}`);
  return r;
};

describe.each(DOCUMENTS.map((d) => [d.id, d] as const))('%s', (_id, doc) => {
  describe.each(DIGIT_STYLES)('digits %s', (digits) => {
    it('extracts the expected strings in logical order', () => {
      const text = squash(get(doc, digits).text);
      for (const expected of expectedText(doc.id, digits)) expect(text).toContain(squash(expected));
    });

    it('has no presentation forms and no digits of the other style', () => {
      const { text } = get(doc, digits);
      expect(text).not.toMatch(PRESENTATION_FORMS);
      if (digits === 'arab') expect(squash(text)).not.toMatch(/[٠-٩][0-9]|[0-9][٠-٩]/);
    });

    it('embeds every font and uses only the uploaded family', () => {
      const { fonts } = get(doc, digits);
      expect(fonts.length).toBeGreaterThan(0);
      for (const font of fonts) {
        expect(font.embedded, font.name).toBe(true);
        expect(font.name, font.name).toMatch(FONTS[CHOSEN_FONT].pdfName);
      }
    });

    it('matches the paper size within 1 mm', () => {
      const { pages } = get(doc, digits);
      for (const page of pages) {
        expect(Math.abs(page.widthPt - doc.paper.widthMm * MM)).toBeLessThanOrEqual(MM);
        if (doc.paper.heightMm !== undefined) {
          expect(Math.abs(page.heightPt - doc.paper.heightMm * MM)).toBeLessThanOrEqual(MM);
        } else {
          expect(pages, 'a continuous roll document is one page (no cut)').toHaveLength(1);
        }
      }
    });
  });
});

describe('report A4', () => {
  const report = DOCUMENTS.find((d) => d.id === 'report-a4');
  it.each(DIGIT_STYLES)(
    'runs over at least two pages with header and "صفحة X من Y" (%s)',
    (digits) => {
      if (!report) throw new Error('report-a4 missing');
      const { pageTexts } = get(report, digits);
      expect(pageTexts.length).toBeGreaterThanOrEqual(2);
      const total = pageTexts.length;
      pageTexts.forEach((pageText, index) => {
        const text = squash(pageText);
        for (const header of report.repeatedText ?? [])
          expect(text, `page ${String(index + 1)}`).toContain(header);
        expect(text).toContain(squash(pageLabel(index + 1, total, digits)));
      });
    },
  );
});

function pageLabel(page: number, total: number, digits: DigitStyle): string {
  const n = (v: number) =>
    digits === 'arab' ? String(v).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d) : String(v);
  return `صفحة ${n(page)} من ${n(total)}`;
}
