// Criterion 8: the vector file is the contract both ports run, so it cannot shrink silently.
import { describe, expect, it } from 'vitest';
import { loadVectors } from './vectors.ts';

const vectors = loadVectors();

describe('shared vector file', () => {
  it('holds at least 200 cases with unique ids', () => {
    expect(vectors.cases.length).toBeGreaterThanOrEqual(200);
    expect(new Set(vectors.cases.map((c) => c.id)).size).toBe(vectors.cases.length);
  });

  it('covers every rule with at least five cases and uses no unknown rule', () => {
    const known = new Set(vectors.rules.map((r) => r.id));
    for (const c of vectors.cases) expect(known, c.id).toContain(c.rule);
    for (const rule of known) {
      expect(
        vectors.cases.filter((c) => c.rule === rule).length,
        `rule ${rule}`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('includes the edge cases of the spec', () => {
    const inputs = new Set(vectors.cases.map((c) => c.input));
    for (const needed of ['', ' ', 'َِ', 'ـــ', 'محمد عبد']) {
      expect(inputs, JSON.stringify(needed)).toContain(needed);
    }
    expect(vectors.cases.some((c) => /[A-Z]/.test(c.input))).toBe(true);
  });
});
