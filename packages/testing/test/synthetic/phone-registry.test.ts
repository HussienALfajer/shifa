import { describe, expect, it } from 'vitest';
import {
  createRandom,
  isSyntheticPhone,
  PhoneRegistry,
  PhoneSpaceExhaustedError,
  SYNTHETIC_PHONE_CAPACITY,
} from '../../src/index.ts';

describe('PhoneRegistry', () => {
  it('states the number space per country', () => {
    expect(SYNTHETIC_PHONE_CAPACITY).toEqual({ SY: 600_000, TR: 3_000_000 });
  });

  it('never repeats a number across 50 000 Syrian draws (the default load size)', () => {
    const registry = new PhoneRegistry();
    const random = createRandom(1);
    const phones = new Set<string>();
    for (let index = 0; index < 50_000; index += 1) {
      const phone = registry.next(random, 'SY');
      expect(isSyntheticPhone(phone)).toBe(true);
      phones.add(phone);
    }
    expect(phones.size).toBe(50_000);
    expect(registry.size).toBe(50_000);
    expect(registry.has([...phones][0] ?? '')).toBe(true);
  });

  it('is deterministic per seed', () => {
    const draw = (): string[] => {
      const registry = new PhoneRegistry();
      const random = createRandom(2);
      return Array.from({ length: 1_000 }, (_, index) =>
        registry.next(random, index % 2 === 0 ? 'SY' : 'TR'),
      );
    };
    expect(draw()).toEqual(draw());
  });

  it('refuses to fill more than half of a country space', () => {
    const registry = new PhoneRegistry();
    const random = createRandom(3);
    for (let index = 0; index < SYNTHETIC_PHONE_CAPACITY.SY / 2; index += 1) {
      registry.next(random, 'SY');
    }
    expect(() => registry.next(random, 'SY')).toThrow(PhoneSpaceExhaustedError);
    expect(isSyntheticPhone(registry.next(random, 'TR'))).toBe(true);
  });
});
