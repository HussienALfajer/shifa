// Drives the display page through its test hook (window.__s6) and reads its in-page log.
import { expect, type Page } from '@playwright/test';

export interface CallInput {
  callId: string;
  number: number;
  room: number;
  nameClipId?: string;
  issuedAt?: number;
}

export type PlayMode = 'full' | 'number-only' | 'chime-only' | 'oscillator';

export interface ScheduledEvent extends DisplayEvent {
  type: 'scheduled';
  callId: string;
  mode: PlayMode;
  clipIds: string[];
  /** Audio-clock seconds: start of each clip, its duration, and the end of the call. */
  starts: number[];
  durations: number[];
  end: number;
}

export interface DisplayEvent {
  type: string;
  callId?: string;
  reason?: string;
  mode?: PlayMode;
  [key: string]: unknown;
}

export interface DisplayState {
  status: 'loading' | 'ready' | 'no-pack';
  audio: string;
  gate: boolean;
  packVersion: string | null;
  clipCount: number;
  latency: { loadToReadyMs: number | null; callToStartMs: number | null };
  wakeLock: { requests: number; held: boolean; error: string | null };
}

/** Opens the page; unless `keepGate`, taps the sound gate if the browser policy shows it. */
export async function openDisplay(
  page: Page,
  params: Record<string, string> = {},
  opts: { keepGate?: boolean; waitReady?: boolean } = {},
): Promise<void> {
  const query = new URLSearchParams(params).toString();
  await page.goto(query ? `/?${query}` : '/');
  await page.waitForFunction(() => '__s6' in window);
  if (opts.waitReady !== false) {
    await expect
      .poll(async () => (await state(page)).status, { timeout: 30_000 })
      .not.toBe('loading');
  }
  if (!opts.keepGate) await tapGate(page);
}

/** Taps the sound gate if the browser's autoplay policy shows it (the default project). */
export async function tapGate(page: Page): Promise<void> {
  if (!(await state(page)).gate) return;
  await page.getByRole('button', { name: 'اضغط لتفعيل الصوت' }).click();
  await expect.poll(async () => (await state(page)).audio).toBe('running');
}

export async function sendCall(page: Page, call: CallInput): Promise<void> {
  await page.evaluate((c) => {
    window.__s6.call({ ...c, issuedAt: c.issuedAt ?? Date.now() });
  }, call);
}

export async function state(page: Page): Promise<DisplayState> {
  return page.evaluate(() => window.__s6.state() as DisplayState);
}

export async function events(page: Page): Promise<DisplayEvent[]> {
  return page.evaluate(() => window.__s6.events as DisplayEvent[]);
}

export async function scheduled(page: Page): Promise<ScheduledEvent[]> {
  return (await events(page)).filter((e): e is ScheduledEvent => e.type === 'scheduled');
}

/** Waits for the 'played' acknowledgement of a call (its last clip ended). */
export async function waitPlayed(page: Page, callId: string, timeout = 60_000): Promise<void> {
  await expect
    .poll(
      async () => (await events(page)).some((e) => e.type === 'played' && e.callId === callId),
      {
        timeout,
      },
    )
    .toBe(true);
}

declare global {
  interface Window {
    __s6: {
      call: (c: CallInput & { issuedAt: number }) => void;
      state: () => unknown;
      events: unknown[];
      renderOffline: (clipIds: string[]) => Promise<{ longestSilenceMs: number; totalMs: number }>;
    };
  }
}
