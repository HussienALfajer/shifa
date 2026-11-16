// Criterion 4: every PDF page matches its golden image within the stated threshold
// (pixelmatch threshold 0.1, at most 0.5 % differing pixels); a shifted layout fails.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIGIT_STYLES } from '../src/digits.ts';
import { compareGolden, PDF_GOLDEN } from '../src/golden.ts';
import { DOCUMENTS, renderInput } from '../src/templates/index.ts';
import { useStack } from './stack.ts';

const stack = useStack();

describe('PDF goldens', () => {
  it.each(DOCUMENTS.flatMap((d) => DIGIT_STYLES.map((s) => [d.id, s] as const)))(
    '%s (%s) matches its goldens page by page',
    async (doc, digits) => {
      const pdf = await stack.gotenberg.renderPdf(renderInput(doc, digits));
      const pages = await stack.pdf.rasterise(pdf);
      expect(pages.length).toBeGreaterThan(0);
      for (const [index, png] of pages.entries()) {
        const result = await compareGolden(
          `pdf/${doc}-${digits}-p${String(index + 1)}.png`,
          png,
          PDF_GOLDEN,
        );
        expect(result.diffRatio, result.message).toBeLessThanOrEqual(PDF_GOLDEN.maxDiffRatio);
      }
    },
  );

  it('fails on a layout shifted by 3 mm and writes a diff image (negative evidence)', async () => {
    const input = renderInput('prescription-a5', 'latn');
    const shifted = {
      ...input,
      html: input.html.replace('</head>', '<style>body{margin-top:3mm}</style></head>'),
    };
    const pages = await stack.pdf.rasterise(await stack.gotenberg.renderPdf(shifted));
    const first = pages[0];
    if (!first) throw new Error('no page');
    const result = await compareGolden('pdf/prescription-a5-latn-p1.png', first, PDF_GOLDEN, {
      diffName: 'negative-shifted-prescription.png',
    });
    expect(result.diffRatio).toBeGreaterThan(PDF_GOLDEN.maxDiffRatio);
    expect(result.diffPath && existsSync(result.diffPath)).toBe(true);
  });
});
