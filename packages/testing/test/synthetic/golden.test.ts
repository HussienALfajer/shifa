// Pins literal output so a change to sfc32, the seed hashing, warm-up or id layout fails here
// (spec 0.2-08 criterion 2: same output on every machine). Update only on purpose, with a PR note.
import { describe, expect, it } from 'vitest';
import { createRandom, generatePhone, nextId } from '../../src/index.ts';

describe('golden values for seed 1', () => {
  it('pins the first uint32 values', () => {
    const random = createRandom(1);
    expect([random.uint32(), random.uint32(), random.uint32()]).toEqual(GOLDEN_UINT32);
  });

  it('pins the first id and a forked phone', () => {
    expect(nextId(createRandom(1))).toBe('31fadbd6-c9df-42c4-a5cf-6cccc1789b62');
    expect(generatePhone(createRandom(1).fork('phones'), 'SY')).toBe(GOLDEN_PHONE);
  });
});

const GOLDEN_UINT32 = [838_523_862, 3_386_856_132, 634_350_796];
const GOLDEN_PHONE = '+963960077550';
