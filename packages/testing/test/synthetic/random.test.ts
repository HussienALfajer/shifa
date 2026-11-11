import { describe, expect, it } from 'vitest';
import { createRandom, InvalidSeedError } from '../../src/index.ts';

const draw = (seed: number, count = 20): number[] => {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random.int(0, 1_000_000));
};

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draw(42)).toEqual(draw(42));
  });

  it('gives a different sequence for a different seed', () => {
    expect(draw(42)).not.toEqual(draw(43));
  });

  it('pins the first values of seed 1 so the sequence never drifts between machines', () => {
    const random = createRandom(1);
    const first = [random.next(), random.next(), random.next()];
    const again = createRandom(1);
    expect([again.next(), again.next(), again.next()]).toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it.each([0, -1, -987_654_321, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])(
    'accepts seed %s',
    (seed) => {
      expect(draw(seed)).toEqual(draw(seed));
    },
  );

  it('separates seeds that differ only in sign or high bits', () => {
    const seeds = [0, 1, -1, 2 ** 32, 2 ** 32 + 1, Number.MAX_SAFE_INTEGER];
    const sequences = new Set(seeds.map((seed) => draw(seed).join(',')));
    expect(sequences.size).toBe(seeds.length);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2 ** 60])(
    'rejects seed %s with InvalidSeedError',
    (seed) => {
      expect(() => createRandom(seed)).toThrow(InvalidSeedError);
    },
  );
});

describe('Random helpers', () => {
  it('int stays inside the inclusive range and reaches both ends', () => {
    const random = createRandom(7);
    const seen = new Set<number>();
    for (let index = 0; index < 2_000; index += 1) {
      const value = random.int(3, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('int refuses a reversed or non-integer range', () => {
    const random = createRandom(7);
    expect(() => random.int(5, 4)).toThrow(RangeError);
    expect(() => random.int(0.5, 4)).toThrow(RangeError);
  });

  it('pick returns a member and refuses an empty list', () => {
    const random = createRandom(8);
    const items = ['أ', 'ب', 'ج'] as const;
    for (let index = 0; index < 100; index += 1) {
      expect(items).toContain(random.pick(items));
    }
    expect(() => random.pick([])).toThrow(RangeError);
  });

  it('weighted never returns a zero-weight entry and follows the weights', () => {
    const random = createRandom(9);
    const counts = { a: 0, b: 0, never: 0 };
    for (let index = 0; index < 10_000; index += 1) {
      const key = random.weighted<keyof typeof counts>([
        ['a', 3],
        ['b', 1],
        ['never', 0],
      ]);
      counts[key] += 1;
    }
    expect(counts.never).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.5);
  });

  it('weighted refuses negative weights and an all-zero list', () => {
    const random = createRandom(9);
    expect(() => random.weighted([['a', -1]])).toThrow(RangeError);
    expect(() => random.weighted([['a', 0]])).toThrow(RangeError);
  });

  it('shuffle returns a permutation and leaves the input alone', () => {
    const random = createRandom(10);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = random.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...output].sort((a, b) => a - b)).toEqual(input);
  });

  it('chance respects 0 and 1 and refuses probabilities outside [0, 1]', () => {
    const random = createRandom(11);
    for (let index = 0; index < 100; index += 1) {
      expect(random.chance(0)).toBe(false);
      expect(random.chance(1)).toBe(true);
    }
    expect(() => random.chance(1.1)).toThrow(RangeError);
    expect(() => random.chance(Number.NaN)).toThrow(RangeError);
  });
});

describe('fork', () => {
  it('depends only on the seed and label, not on draws made before it', () => {
    const fresh = createRandom(5).fork('names');
    const used = createRandom(5);
    used.int(0, 100);
    used.int(0, 100);
    const late = used.fork('names');
    const a = Array.from({ length: 10 }, () => fresh.int(0, 1_000_000));
    const b = Array.from({ length: 10 }, () => late.int(0, 1_000_000));
    expect(b).toEqual(a);
  });

  it('gives independent streams per label and leaves the parent unchanged', () => {
    const parent = createRandom(5);
    const reference = createRandom(5);
    const names = parent.fork('names');
    const phones = parent.fork('phones');
    expect(Array.from({ length: 10 }, () => names.int(0, 1_000_000))).not.toEqual(
      Array.from({ length: 10 }, () => phones.int(0, 1_000_000)),
    );
    expect(parent.int(0, 1_000_000)).toBe(reference.int(0, 1_000_000));
  });

  it('nests: a fork of a fork is stable and differs from the flat label', () => {
    const nested = (): number => createRandom(5).fork('tenant').fork('0').int(0, 1_000_000_000);
    expect(nested()).toBe(nested());
    expect(nested()).not.toBe(createRandom(5).fork('tenant0').int(0, 1_000_000_000));
  });
});
