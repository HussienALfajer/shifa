// Exponential backoff with jitter on 429 and 5xx (and network failures), honouring Retry-After.
import { ProviderError } from './provider.ts';

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  capMs?: number;
  sleep: (ms: number) => Promise<void>;
  /** 0..1; jitter scales the wait between half and the full backoff. */
  random?: () => number;
}

export type RetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: unknown; attempts: number };

export const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 5, baseMs = 1000, capMs = 30_000, sleep, random = Math.random }: RetryOptions,
): Promise<RetryResult<T>> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return { ok: true, value: await fn(), attempts: attempt };
    } catch (error) {
      const retryable = error instanceof ProviderError && error.retryable;
      if (!retryable || attempt >= maxAttempts) return { ok: false, error, attempts: attempt };
      const backoff = Math.min(capMs, baseMs * 2 ** (attempt - 1));
      const wait = error.retryAfterMs ?? Math.round(backoff * (0.5 + 0.5 * random()));
      await sleep(wait);
    }
  }
}
