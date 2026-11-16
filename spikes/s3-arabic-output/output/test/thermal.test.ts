// Criterion 6: receipts and tickets render to 1-bit images 576 px (80 mm) and 384 px (58 mm)
// wide, encode to ESC/POS `GS v 0` and decode back to the same image, which matches its golden.
import { describe, expect, it } from 'vitest';
import { DIGIT_STYLES } from '../src/digits.ts';
import { compareGolden, THERMAL_GOLDEN } from '../src/golden.ts';
import { DOCUMENTS, renderThermalInput } from '../src/templates/index.ts';
import {
  bitmapToPng,
  DITHER_MODES,
  encodeRaster,
  MAX_BAND_ROWS,
  pngToBitmap,
} from '../src/thermal.ts';
import { decodeRaster } from './escpos-decode.ts';
import { useStack } from './stack.ts';

const stack = useStack();
const ROLL_DOCS = DOCUMENTS.filter((d) => d.thermalWidthPx !== undefined);

describe('thermal raster', () => {
  it('covers receipt and ticket at both widths', () => {
    expect(ROLL_DOCS.map((d) => d.thermalWidthPx).sort()).toEqual(
      expect.arrayContaining([384, 576]),
    );
    expect(ROLL_DOCS.some((d) => d.id.startsWith('receipt'))).toBe(true);
    expect(ROLL_DOCS.some((d) => d.id.startsWith('ticket'))).toBe(true);
  });

  describe.each(ROLL_DOCS.map((d) => [d.id, d] as const))('%s', (_id, doc) => {
    it.each(DIGIT_STYLES.flatMap((s) => DITHER_MODES.map((m) => [s, m] as const)))(
      'renders, encodes and decodes losslessly (%s, %s)',
      async (digits, mode) => {
        const width = doc.thermalWidthPx ?? 0;
        const png = await stack.gotenberg.screenshot(renderThermalInput(doc.id, digits), width);
        const bitmap = pngToBitmap(png, mode);
        expect(bitmap.width).toBe(width);
        expect(bitmap.data.every((v) => v === 0 || v === 1)).toBe(true);

        const stream = encodeRaster(bitmap);
        expect([...stream.subarray(0, 2)]).toEqual([0x1b, 0x40]);
        const firstBand = stream.indexOf(0x1d);
        expect([...stream.subarray(firstBand, firstBand + 4)]).toEqual([0x1d, 0x76, 0x30, 0x00]);

        const decoded = decodeRaster(stream);
        expect(decoded.bitmap.width).toBe(bitmap.width);
        expect(decoded.bitmap.height).toBe(bitmap.height);
        expect(Buffer.from(decoded.bitmap.data).equals(Buffer.from(bitmap.data))).toBe(true);
        expect(decoded.bandHeights.every((h) => h > 0 && h <= MAX_BAND_ROWS)).toBe(true);
        expect(decoded.cuts).toEqual([]);
        expect(decoded.stray).toBe(0);

        const result = await compareGolden(
          `thermal/${doc.id}-${digits}-${mode}.png`,
          bitmapToPng(decoded.bitmap),
          THERMAL_GOLDEN,
        );
        expect(result.diffRatio, result.message).toBeLessThanOrEqual(THERMAL_GOLDEN.maxDiffRatio);
      },
    );
  });

  it('keeps a long receipt in one stream of several bands with no cut', async () => {
    const long = DOCUMENTS.find((d) => d.id === 'receipt-long-58');
    if (!long?.thermalWidthPx) throw new Error('receipt-long-58 missing');
    const png = await stack.gotenberg.screenshot(
      renderThermalInput(long.id, 'latn'),
      long.thermalWidthPx,
    );
    const decoded = decodeRaster(encodeRaster(pngToBitmap(png, 'threshold')));
    expect(decoded.bandHeights.length).toBeGreaterThan(1);
    expect(decoded.cuts).toEqual([]);
  });
});
