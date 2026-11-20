// Backlog "Compact density on touch devices" (slice 0.4-03): compact rows are 32 px, below the
// 44 px touch target, so a coarse pointer always gets comfortable. The provider itself is tested
// in a real browser (test/density.test.tsx).
import { describe, expect, it } from 'vitest';
import { resolveDensity } from '../src/density/resolve.ts';

describe('resolveDensity', () => {
  it('keeps the requested density on a fine pointer', () => {
    expect(resolveDensity('compact', { coarsePointer: false })).toEqual({
      density: 'compact',
      refused: false,
    });
    expect(resolveDensity('comfortable', { coarsePointer: false }).density).toBe('comfortable');
  });

  it('refuses compact on a coarse pointer and falls back to comfortable', () => {
    expect(resolveDensity('compact', { coarsePointer: true })).toEqual({
      density: 'comfortable',
      refused: true,
    });
  });

  it('keeps comfortable on a coarse pointer without a refusal', () => {
    expect(resolveDensity('comfortable', { coarsePointer: true })).toEqual({
      density: 'comfortable',
      refused: false,
    });
  });
});
