import { describe, expect, it } from 'vitest';
import { createRandom, DuplicateIdError, IdRegistry, nextId } from '../../src/index.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('nextId', () => {
  it('returns UUID v4-format strings', () => {
    const random = createRandom(1);
    for (let index = 0; index < 1_000; index += 1) {
      expect(nextId(random)).toMatch(UUID_V4);
    }
  });

  it('is deterministic per seed', () => {
    const a = createRandom(3);
    const b = createRandom(3);
    expect([nextId(a), nextId(a)]).toEqual([nextId(b), nextId(b)]);
  });

  it.each([1, 2, 3])('gives 100 000 unique ids for seed %s', (seed) => {
    const random = createRandom(seed);
    const ids = new Set<string>();
    for (let index = 0; index < 100_000; index += 1) {
      ids.add(nextId(random));
    }
    expect(ids.size).toBe(100_000);
  });
});

describe('IdRegistry', () => {
  it('accepts new ids and throws DuplicateIdError on a repeat', () => {
    const registry = new IdRegistry();
    const random = createRandom(4);
    const id = nextId(random);
    registry.register(id);
    registry.register(nextId(random));
    expect(registry.has(id)).toBe(true);
    expect(registry.size).toBe(2);
    expect(() => {
      registry.register(id);
    }).toThrow(DuplicateIdError);
  });

  it('next() draws and registers in one step', () => {
    const registry = new IdRegistry();
    const random = createRandom(4);
    const id = registry.next(random);
    expect(id).toMatch(UUID_V4);
    expect(registry.has(id)).toBe(true);
  });
});
