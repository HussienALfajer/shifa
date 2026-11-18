// Criterion 8 (VOX-17): one tap under the default autoplay policy; none with the kiosk setting.
import { expect, test } from '@playwright/test';
import { openDisplay, scheduled, sendCall, state, waitPlayed } from './helpers.ts';

const GATE = 'اضغط لتفعيل الصوت';

test('default policy: the gate holds audio until one tap, then later calls need no tap', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'default', 'default autoplay policy only');
  await openDisplay(page, {}, { keepGate: true });
  const gate = page.getByRole('button', { name: GATE });
  await expect(gate).toBeVisible();
  expect((await state(page)).audio).toBe('suspended');

  await sendCall(page, { callId: 'a-1', number: 3, room: 1 });
  await page.waitForTimeout(1_000);
  expect(await scheduled(page)).toHaveLength(0);

  await gate.click();
  await expect(gate).toBeHidden();
  await waitPlayed(page, 'a-1');

  for (const id of ['a-2', 'a-3', 'a-4']) {
    await sendCall(page, { callId: id, number: 4, room: 2 });
  }
  await waitPlayed(page, 'a-4', 90_000);
  expect((await scheduled(page)).map((p) => p.callId)).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
  await expect(gate).toBeHidden();
  expect((await state(page)).audio).toBe('running');
});

test('kiosk autoplay setting: no gate, the first call plays with no tap', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'kiosk', 'kiosk autoplay project only');
  await openDisplay(page, {}, { keepGate: true });
  await expect(page.getByRole('button', { name: GATE })).toBeHidden();
  expect((await state(page)).gate).toBe(false);
  await sendCall(page, { callId: 'k-1', number: 6, room: 3 });
  await waitPlayed(page, 'k-1');
  expect((await state(page)).audio).toBe('running');
});
