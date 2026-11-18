// Criterion 7 (VOX-11): the pack is cached by the service worker and plays offline.
import { expect, test } from '@playwright/test';
import { events, openDisplay, scheduled, sendCall, state, tapGate, waitPlayed } from './helpers.ts';

test('after the first load every clip of the pack is in Cache Storage', async ({ page }) => {
  await openDisplay(page);
  const s = await state(page);
  expect(s.status).toBe('ready');
  expect(s.packVersion).toMatch(/^[0-9a-f]{16,}$/u);
  expect(s.clipCount).toBe(178);
  const cached = await page.evaluate(async (version) => {
    const cache = await caches.open(`s6-pack-${version}`);
    const keys = await cache.keys();
    return keys.map((r) => new URL(r.url).pathname);
  }, s.packVersion ?? '');
  expect(cached).toContain('/pack/manifest.json');
  expect(cached.filter((p) => p.endsWith('.wav'))).toHaveLength(178);
  expect(s.latency.loadToReadyMs).toBeGreaterThan(0);
});

test('an offline reload still plays from the cache', async ({ page, context }) => {
  await openDisplay(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await openDisplay(page); // navigates again with the network off
  expect((await state(page)).status).toBe('ready');
  await sendCall(page, { callId: 'off-1', number: 21, room: 3, nameClipId: 'name-m01' });
  await waitPlayed(page, 'off-1');
  const [call] = await scheduled(page);
  expect(call?.mode).toBe('full');
  expect(call?.clipIds).toEqual(['chime', 'name-m01', 'number-021', 'room-3']);
  const latency = (await state(page)).latency;
  expect(latency.callToStartMs).not.toBeNull();
  expect(latency.callToStartMs ?? -1).toBeGreaterThanOrEqual(0);
  await context.setOffline(false);
});

test('a call during the pack download waits, then plays', async ({ page }) => {
  await openDisplay(page, { delayPackMs: '2500' }, { waitReady: false });
  expect((await state(page)).status).toBe('loading');
  await sendCall(page, { callId: 'early-1', number: 5, room: 1 });
  expect(await scheduled(page)).toHaveLength(0);
  await expect.poll(async () => (await state(page)).status, { timeout: 30_000 }).toBe('ready');
  await tapGate(page);
  await waitPlayed(page, 'early-1');
  const [call] = await scheduled(page);
  expect(call?.mode).toBe('full');
  expect(call?.clipIds).toEqual(['chime', 'number-005', 'room-1']);
});

test('a call during a failed pack download falls back to the oscillator chime and flash', async ({
  page,
}) => {
  await openDisplay(page, { pack: 'missing-pack' }, { waitReady: false });
  await sendCall(page, { callId: 'nopack-1', number: 12, room: 4 });
  await expect.poll(async () => (await state(page)).status, { timeout: 30_000 }).toBe('no-pack');
  await tapGate(page);
  await waitPlayed(page, 'nopack-1');
  expect((await scheduled(page))[0]?.mode).toBe('oscillator');
  expect((await events(page)).some((e) => e.type === 'flash' && e.callId === 'nopack-1')).toBe(
    true,
  );
});
