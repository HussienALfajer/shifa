// What the page tells its host (the test, playing the application) after every request: the
// bytes it put on the wire, the bytes the server confirmed, interruptions and the outcome.
// Kept in memory only; nothing goes to browser storage (spec: server state only).

declare global {
  interface Window {
    /** A fresh uploader token from the application. */
    s4Token?: () => Promise<string>;
    s4Report?: (stats: Stats) => Promise<void>;
  }
}

export type Mode = 'chunked' | 'stow';

export interface Stats {
  mode: Mode;
  sentBytes: number;
  ackedBytes: number;
  resumedBytes: number;
  /** One entry per interruption (`path#n`): a failed request or a refused offset. */
  interrupted: string[];
  skipped: string[];
  files: number;
  chunkSize: number;
  outcome: 'running' | 'done' | 'failed';
  ms: number;
}

const started = performance.now();
const interruptions = new Map<string, number>();

export const stats: Stats = {
  mode: 'chunked',
  sentBytes: 0,
  ackedBytes: 0,
  resumedBytes: 0,
  interrupted: [],
  skipped: [],
  files: 0,
  chunkSize: 0,
  outcome: 'running',
  ms: 0,
};

export function interrupted(path: string): void {
  const n = (interruptions.get(path) ?? 0) + 1;
  interruptions.set(path, n);
  stats.interrupted.push(`${path}#${String(n)}`);
}

export async function report(): Promise<void> {
  stats.ms = Math.round(performance.now() - started);
  await window.s4Report?.({ ...stats, interrupted: [...stats.interrupted] });
}

export async function token(): Promise<string> {
  if (!window.s4Token) throw new Error('no token source');
  return window.s4Token();
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Exponential backoff with full jitter, capped at 30 s. */
export const backoff = (attempt: number) =>
  sleep(Math.random() * Math.min(30_000, 500 * 2 ** attempt));
