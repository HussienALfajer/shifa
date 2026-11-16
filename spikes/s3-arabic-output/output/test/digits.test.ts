// OD-20 stays open: every template takes a digit style; both must format the same numbers.
import { describe, expect, it } from 'vitest';
import { DIGIT_STYLES, formatNumber } from '../src/digits.ts';

describe('formatNumber', () => {
  it('lists both digit styles', () => {
    expect(DIGIT_STYLES).toEqual(['latn', 'arab']);
  });

  it('formats integers with grouping', () => {
    expect(formatNumber(1_234_567, 'latn')).toBe('1,234,567');
    expect(formatNumber(1_234_567, 'arab')).toBe('١٬٢٣٤٬٥٦٧');
    expect(formatNumber(0, 'arab')).toBe('٠');
  });

  it('formats decimals with a fixed number of places', () => {
    expect(formatNumber(12.5, 'latn', 2)).toBe('12.50');
    expect(formatNumber(12.5, 'arab', 2)).toBe('١٢٫٥٠');
  });

  it('formats without grouping for ticket and page numbers', () => {
    expect(formatNumber(1042, 'latn', 0, false)).toBe('1042');
    expect(formatNumber(1042, 'arab', 0, false)).toBe('١٠٤٢');
  });
});
