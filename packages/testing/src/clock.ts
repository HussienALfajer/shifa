/**
 * Source of the current time. Production code receives a Clock instead of calling `Date.now()`,
 * so tests can pin time (appointment slots, queue order, exchange-rate snapshots).
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock that only moves when the test moves it. */
export class FixedClock implements Clock {
  #epochMs: number;

  constructor(start: Date | string) {
    const epochMs = new Date(start).getTime();
    if (Number.isNaN(epochMs)) {
      throw new RangeError(`FixedClock: invalid start time "${String(start)}"`);
    }
    this.#epochMs = epochMs;
  }

  now(): Date {
    return new Date(this.#epochMs);
  }

  advanceBy(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError('FixedClock: time can only move forward by a finite amount');
    }
    this.#epochMs += ms;
  }

  set(to: Date | string): void {
    const epochMs = new Date(to).getTime();
    if (Number.isNaN(epochMs) || epochMs < this.#epochMs) {
      throw new RangeError('FixedClock: time can only move forward');
    }
    this.#epochMs = epochMs;
  }
}
