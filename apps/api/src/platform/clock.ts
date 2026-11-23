// The time source of code that decides by time (session limits, locks). Tests inject a clock that
// only moves when they move it (FixedClock from @shifa/testing has the same shape).
export interface Clock {
  now(): Date;
}

/** Injection token: `@Inject(CLOCK) clock: Clock`. */
export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
