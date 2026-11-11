import type { Random } from './random.ts';

export class DuplicateIdError extends Error {
  constructor(id: string) {
    super(`Synthetic id ${id} was generated twice`);
    this.name = 'DuplicateIdError';
  }
}

const hex8 = (value: number): string => value.toString(16).padStart(8, '0');

/** A UUID v4-format string drawn from the seeded source (version 4, RFC 9562 variant bits). */
export const nextId = (random: Random): string => {
  const a = random.uint32();
  const b = ((random.uint32() & 0xff_ff_0f_ff) | 0x00_00_40_00) >>> 0;
  const c = ((random.uint32() & 0x3f_ff_ff_ff) | 0x80_00_00_00) >>> 0;
  const d = random.uint32();
  const text = `${hex8(a)}${hex8(b)}${hex8(c)}${hex8(d)}`;
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
};

/** Tracks every id in one dataset and refuses a repeat, so integrity never rests on luck. */
export class IdRegistry {
  readonly #ids = new Set<string>();

  get size(): number {
    return this.#ids.size;
  }

  has(id: string): boolean {
    return this.#ids.has(id);
  }

  register(id: string): void {
    if (this.#ids.has(id)) throw new DuplicateIdError(id);
    this.#ids.add(id);
  }

  next(random: Random): string {
    const id = nextId(random);
    this.register(id);
    return id;
  }
}
