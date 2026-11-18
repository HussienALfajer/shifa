// Criterion 7 (VOX-18): a missing clip or pack never silences a call.
import { expect, test } from '@playwright/test';
import { events, openDisplay, scheduled, sendCall, waitPlayed } from './helpers.ts';

test('a missing name clip plays the number-only call', async ({ page }) => {
  await openDisplay(page);
  await sendCall(page, { callId: 'f-1', number: 20, room: 2, nameClipId: 'name-zz99' });
  await waitPlayed(page, 'f-1');
  const [call] = await scheduled(page);
  expect(call?.mode).toBe('number-only');
  expect(call?.clipIds).toEqual(['chime', 'number-020', 'room-2']);
});

test('a missing number clip plays the chime and flashes number and room', async ({ page }) => {
  await openDisplay(page);
  await sendCall(page, { callId: 'f-2', number: 998, room: 3 });
  await waitPlayed(page, 'f-2');
  const [call] = await scheduled(page);
  expect(call?.mode).toBe('chime-only');
  expect(call?.clipIds).toEqual(['chime']);
  const flash = page.getByTestId('flash');
  await expect(flash).toBeVisible();
  await expect(flash).toContainText('998');
  await expect(flash).toContainText('3');
});

test('no pack: an oscillator chime and a flash of about 8 s', async ({ page }) => {
  await openDisplay(page, { pack: 'missing-pack' });
  await sendCall(page, { callId: 'f-3', number: 44, room: 1 });
  await waitPlayed(page, 'f-3');
  const [call] = await scheduled(page);
  expect(call?.mode).toBe('oscillator');
  const flash = page.getByTestId('flash');
  await expect(flash).toBeVisible();
  await expect(flash).toContainText('44');
  const shownAt = Date.now();
  await expect(flash).toBeHidden({ timeout: 12_000 });
  const shownMs = Date.now() - shownAt;
  expect(shownMs).toBeGreaterThan(5_000);
  const flashEvent = (await events(page)).find((e) => e.type === 'flash' && e.callId === 'f-3');
  expect(flashEvent?.['ms']).toBe(8_000);
});

test('every call flashes its number and room', async ({ page }) => {
  await openDisplay(page);
  await sendCall(page, { callId: 'f-4', number: 33, room: 4 });
  await expect(page.getByTestId('flash')).toContainText('33');
  await waitPlayed(page, 'f-4');
});
