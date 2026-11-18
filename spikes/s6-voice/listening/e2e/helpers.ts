// Drives the listening page through its buttons and reads its test hook (window.__s6l).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import type { ListeningKey, ListeningSet } from '@shifa-spike/s6-tts';

/** The test set made by scripts/make-test-set.ts (fake provider, five fake voices). */
export const TEST_SET_DIR = join(import.meta.dirname, '..', 'test-set');

export function readKey(kind: 'full' | 'pre-round'): ListeningKey {
  const file = kind === 'full' ? 'listening-key.json' : 'pre-round-key.json';
  return JSON.parse(readFileSync(join(TEST_SET_DIR, file), 'utf8')) as ListeningKey;
}

export async function fetchSet(page: Page, kind: 'full' | 'pre-round'): Promise<ListeningSet> {
  const file = kind === 'full' ? 'listening-set.json' : 'pre-round-set.json';
  const res = await page.request.get(`/${file}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as ListeningSet;
}

export interface PlayEvent {
  type: 'play';
  codes: string[];
  starts: number[];
  durations: number[];
}

export interface PageState {
  phase: 'loading' | 'rating' | 'pairs' | 'done' | 'pre-round' | 'error';
  index: number;
  total: number;
  ratings: Record<string, { naturalness: number; wrong: boolean | null; note: string }>;
  pairs: Record<string, 'a' | 'b' | 'same'>;
  events: PlayEvent[];
}

export async function openPage(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => '__s6l' in window);
  await expect
    .poll(async () => (await pageState(page)).phase, { timeout: 30_000 })
    .not.toBe('loading');
}

export async function pageState(page: Page): Promise<PageState> {
  return page.evaluate(() => window.__s6l.state() as PageState);
}

/** Rates the clip on screen: a score, correct/wrong where asked, an optional note, then next. */
export async function rateCurrent(
  page: Page,
  answer: { score: number; wrong?: boolean; note?: string },
): Promise<void> {
  const view = page.getByTestId('rating');
  await page.getByTestId(`score-${String(answer.score)}`).click();
  if ((await view.getAttribute('data-judged')) === 'true') {
    await page.getByTestId(answer.wrong ? 'wrong' : 'correct').click();
  }
  if (answer.note) await page.getByTestId('note').fill(answer.note);
  await page.getByTestId('next').click();
}

/** Rates every remaining clip with the keyboard (keys 1-5, ص / خ, Enter). */
export async function rateAllWithKeys(page: Page, score = 4): Promise<void> {
  for (;;) {
    const s = await pageState(page);
    if (s.phase !== 'rating') return;
    await page.keyboard.press(`Digit${String(score)}`);
    const judged = await page.getByTestId('rating').getAttribute('data-judged');
    if (judged === 'true') await page.keyboard.press('KeyW'); // ص on an Arabic layout
    await page.keyboard.press('Enter');
  }
}

declare global {
  interface Window {
    __s6l: { state: () => unknown };
  }
}
