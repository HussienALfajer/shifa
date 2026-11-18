// Criterion 7 (VOX-12): the clips of one call are joined back to back, with no audible gap.
import { expect, test } from '@playwright/test';
import { openDisplay, scheduled, sendCall, waitPlayed } from './helpers.ts';

test('joins within a call are back to back in the schedule (± 1 ms)', async ({ page }) => {
  await openDisplay(page);
  await sendCall(page, { callId: 'g-1', number: 111, room: 5, nameClipId: 'name-f10' });
  await waitPlayed(page, 'g-1');
  const [call] = await scheduled(page);
  if (!call) throw new Error('not scheduled');
  expect(call.clipIds).toHaveLength(4);
  for (let i = 1; i < call.starts.length; i += 1) {
    const prevEnd = (call.starts[i - 1] ?? 0) + (call.durations[i - 1] ?? 0);
    expect(Math.abs((call.starts[i] ?? 0) - prevEnd)).toBeLessThanOrEqual(0.001);
  }
  const last = call.starts.length - 1;
  expect(call.end).toBeCloseTo((call.starts[last] ?? 0) + (call.durations[last] ?? 0), 3);
});

test('an offline render of a call has no silence over 10 ms', async ({ page }) => {
  await openDisplay(page);
  const result = await page.evaluate(() =>
    window.__s6.renderOffline(['chime', 'name-m05', 'number-120', 'room-2']),
  );
  expect(result.totalMs).toBeGreaterThan(1000);
  expect(result.longestSilenceMs).toBeLessThanOrEqual(10);
});
