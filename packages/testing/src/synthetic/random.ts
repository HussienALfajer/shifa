/**
 * Seeded pseudo-random source for the synthetic data generator.
 *
 * sfc32 (Chris Doty-Humphrey's Small Fast Counting generator) seeded from a cyrb128 hash of a
 * stream key. Both use only 32-bit integer maths, so every JavaScript engine gives the same
 * sequence for the same seed. Not cryptographic: it makes test data, nothing else.
 */

export class InvalidSeedError extends TypeError {
  constructor(seed: unknown) {
    super(`Synthetic seed must be a safe integer, got ${String(seed)}`);
    this.name = 'InvalidSeedError';
  }
}

const UINT32_RANGE = 0x1_0000_0000;
const WARM_UP_ROUNDS = 15;

/** cyrb128 string hash: four 32-bit words of state from one key. */
const hashKey = (key: string): [number, number, number, number] => {
  let h1 = 1_779_033_703;
  let h2 = 3_144_134_277;
  let h3 = 1_013_904_242;
  let h4 = 2_773_480_762;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597_399_067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2_869_860_233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951_274_213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2_716_044_179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597_399_067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2_869_860_233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951_274_213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2_716_044_179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
};

export interface Random {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, 2^32). */
  uint32(): number;
  /** Integer in [min, max], both inclusive; the range may hold at most 2^32 values. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Picks a value with probability proportional to its weight (weights ≥ 0, sum > 0). */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** A shuffled copy; the input is left alone. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability `p` in [0, 1]. */
  chance(p: number): boolean;
  /**
   * An independent stream that depends only on the root seed and the label path, never on how
   * many values were drawn before. Give every new field its own fork so adding it later does
   * not shift the values of every other field.
   *
   * The same label on the same parent always returns the same stream, so labels must be unique
   * per parent: in a loop, fork by index (`fork(String(index))`) and then by field.
   */
  fork(label: string): Random;
}

class Sfc32 implements Random {
  readonly #key: string;
  #a: number;
  #b: number;
  #c: number;
  #d: number;

  constructor(key: string) {
    this.#key = key;
    [this.#a, this.#b, this.#c, this.#d] = hashKey(key);
    for (let round = 0; round < WARM_UP_ROUNDS; round += 1) this.uint32();
  }

  uint32(): number {
    let t = (this.#a + this.#b) | 0;
    this.#a = this.#b ^ (this.#b >>> 9);
    this.#b = (this.#c + (this.#c << 3)) | 0;
    this.#c = (this.#c << 21) | (this.#c >>> 11);
    this.#d = (this.#d + 1) | 0;
    t = (t + this.#d) | 0;
    this.#c = (this.#c + t) | 0;
    return t >>> 0;
  }

  next(): number {
    return this.uint32() / UINT32_RANGE;
  }

  int(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
      throw new RangeError(`Random.int: invalid range [${String(min)}, ${String(max)}]`);
    }
    const size = max - min + 1;
    if (size > UINT32_RANGE) throw new RangeError('Random.int: range holds more than 2^32 values');
    return min + Math.floor(this.next() * size);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Random.pick: empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, weight] of entries) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError('Random.weighted: weights must be finite and non-negative');
      }
      total += weight;
    }
    if (total <= 0) throw new RangeError('Random.weighted: weights must sum to more than 0');
    let target = this.next() * total;
    for (const [value, weight] of entries) {
      if (weight > 0 && target < weight) return value;
      target -= weight;
    }
    // Floating-point rest: return the last entry with a positive weight.
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry !== undefined && entry[1] > 0) return entry[0];
    }
    throw new RangeError('Random.weighted: no entry with a positive weight');
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = this.int(0, index);
      [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
    }
    return copy;
  }

  chance(p: number): boolean {
    if (!(p >= 0 && p <= 1)) throw new RangeError('Random.chance: p must be in [0, 1]');
    return this.next() < p;
  }

  fork(label: string): Random {
    // Length-prefixed so fork('a/b') and fork('a').fork('b') never share a key.
    return new Sfc32(`${this.#key}/${String(label.length)}:${label}`);
  }
}

export const createRandom = (seed: number): Random => {
  if (!Number.isSafeInteger(seed)) throw new InvalidSeedError(seed);
  return new Sfc32(`shifa-synthetic:${String(seed)}`);
};
