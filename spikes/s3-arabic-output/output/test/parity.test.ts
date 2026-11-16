// Criterion 5: the same HTML printed by Playwright Chromium (browser print) gives the same page
// count, page size and extracted text as Gotenberg. Roll documents (receipt, ticket) print as
// one continuous page in Gotenberg only, so for them width and text are compared.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type BrowserPrinter, startBrowserPrinter } from '../src/browser-print.ts';
import { DIGIT_STYLES } from '../src/digits.ts';
import { DOCUMENTS, renderInput } from '../src/templates/index.ts';
import { squash, useStack } from './stack.ts';

const stack = useStack();
let printer: BrowserPrinter;
const MM = 72 / 25.4;

beforeAll(async () => {
  printer = await startBrowserPrinter();
});
afterAll(async () => {
  await printer.close();
});

describe.each(DOCUMENTS.map((d) => [d.id, d] as const))('%s', (_id, doc) => {
  it.each(DIGIT_STYLES)('browser print matches Gotenberg (%s)', async (digits) => {
    const input = renderInput(doc.id, digits);
    const server = await stack.gotenberg.renderPdf(input);
    const browser = await printer.print(input, doc);
    const [serverPages, browserPages] = [
      await stack.pdf.info(server),
      await stack.pdf.info(browser),
    ];

    expect(squash(await stack.pdf.text(browser))).toBe(squash(await stack.pdf.text(server)));
    if (doc.paper.heightMm !== undefined) {
      expect(browserPages.length).toBe(serverPages.length);
      browserPages.forEach((page, index) => {
        const other = serverPages[index];
        expect(Math.abs(page.widthPt - (other?.widthPt ?? 0))).toBeLessThanOrEqual(MM);
        expect(Math.abs(page.heightPt - (other?.heightPt ?? 0))).toBeLessThanOrEqual(MM);
      });
    } else {
      for (const page of browserPages) {
        expect(Math.abs(page.widthPt - doc.paper.widthMm * MM)).toBeLessThanOrEqual(MM);
      }
    }
  });
});
