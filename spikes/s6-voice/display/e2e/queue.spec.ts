// Criterion 7 (VOX-13, VOX-16): a serial FIFO queue with a 1.5 s gap, dedupe and stale calls.
import { expect, test } from '@playwright/test';
import { events, openDisplay, scheduled, sendCall, waitPlayed } from './helpers.ts';

const GAP_S = 1.5;

test('five calls within one second play in order, never overlapping, gaps of at least 1.5 s', async ({
  page,
}) => {
  await openDisplay(page);
  const calls = [
    { callId: 'q-1', number: 1, room: 1, nameClipId: 'name-m02' },
    { callId: 'q-2', number: 11, room: 2 },
    { callId: 'q-3', number: 101, room: 3, nameClipId: 'name-f03' },
    { callId: 'q-4', number: 215, room: 4 },
    { callId: 'q-5', number: 999, room: 5, nameClipId: 'name-plain-m01' },
  ];
  for (const c of calls) await sendCall(page, c);
  await waitPlayed(page, 'q-5', 120_000);

  const played = await scheduled(page);
  expect(played.map((p) => p.callId)).toEqual(calls.map((c) => c.callId));
  expect(played.every((p) => p.mode === 'full')).toBe(true);
  for (let i = 1; i < played.length; i += 1) {
    const prev = played[i - 1];
    const next = played[i];
    if (!prev || !next) throw new Error('missing call');
    expect(next.starts[0] ?? 0).toBeGreaterThanOrEqual(prev.end + GAP_S - 0.001);
  }
  const acks = (await events(page)).filter((e) => e.type === 'played').map((e) => e.callId);
  expect(acks).toEqual(calls.map((c) => c.callId));
});

test('the same call_id twice plays once', async ({ page }) => {
  await openDisplay(page);
  await sendCall(page, { callId: 'dup-1', number: 7, room: 2 });
  await sendCall(page, { callId: 'dup-1', number: 7, room: 2 });
  await waitPlayed(page, 'dup-1');
  await sendCall(page, { callId: 'dup-1', number: 7, room: 2 });
  await page.waitForTimeout(500);
  expect((await scheduled(page)).filter((p) => p.callId === 'dup-1')).toHaveLength(1);
  const drops = (await events(page)).filter((e) => e.type === 'dropped' && e.callId === 'dup-1');
  expect(drops.map((d) => d.reason)).toEqual(['duplicate', 'duplicate']);
});

test('a call older than 60 s does not play', async ({ page }) => {
  await openDisplay(page);
  await sendCall(page, { callId: 'stale-1', number: 8, room: 1, issuedAt: Date.now() - 61_000 });
  await sendCall(page, { callId: 'fresh-1', number: 9, room: 1 });
  await waitPlayed(page, 'fresh-1');
  expect((await scheduled(page)).map((p) => p.callId)).toEqual(['fresh-1']);
  const drop = (await events(page)).find((e) => e.type === 'dropped' && e.callId === 'stale-1');
  expect(drop?.reason).toBe('stale');
});

test('a reload mid-queue does not replay finished calls', async ({ page }) => {
  await openDisplay(page);
  const calls = [
    { callId: 'r-1', number: 13, room: 1 },
    { callId: 'r-2', number: 14, room: 2 },
    { callId: 'r-3', number: 15, room: 3 },
  ];
  for (const c of calls) await sendCall(page, c);
  await waitPlayed(page, 'r-1');
  await page.reload();
  await openDisplay(page);
  // The reception side re-sends everything it believes is pending.
  for (const c of calls) await sendCall(page, c);
  await waitPlayed(page, 'r-3');
  const after = (await scheduled(page)).map((p) => p.callId);
  expect(after).not.toContain('r-1');
  expect(after).toContain('r-3');
  const drop = (await events(page)).find((e) => e.type === 'dropped' && e.callId === 'r-1');
  expect(drop?.reason).toBe('duplicate');
});
