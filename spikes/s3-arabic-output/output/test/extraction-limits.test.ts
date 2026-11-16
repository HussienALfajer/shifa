// Known limits of the PDF text layer (report §"PDF text layer"), pinned so that a change in
// Chromium or in the reader shows up: the lam-alef ligature comes out of the text layer
// reversed. The printed page is right (goldens); only copied or searched text is wrong.
import { describe, expect, it } from 'vitest';
import { renderInput } from '../src/templates/index.ts';
import { useStack } from './stack.ts';

const stack = useStack();

describe('PDF text layer limits', () => {
  it('extracts the lam-alef ligature reversed ("دولار" as "دوالر")', async () => {
    const text = await stack.pdf.text(
      await stack.gotenberg.renderPdf(renderInput('receipt-58', 'latn')),
    );
    expect(text).toContain('دوالر');
    expect(text).not.toContain('دولار');
  });
});
