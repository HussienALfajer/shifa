// Criterion 5: the ten announcements compared in pairs. 20 pairs; each side plays its four clips
// (chime → name → number → room) joined back to back in order; choices are saved and survive a
// reload.
import { expect, test } from '@playwright/test';
import { fetchSet, openPage, pageState, rateAllWithKeys } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await openPage(page);
  await rateAllWithKeys(page, 4);
});

test('shows 20 pairs and plays each side joined in order', async ({ page }) => {
  const set = await fetchSet(page, 'full');
  if (set.kind !== 'full') throw new Error('full set expected');
  expect(set.pairs).toHaveLength(20);
  const s = await pageState(page);
  expect(s.phase).toBe('pairs');
  expect(s.total).toBe(20);

  for (const [i, pair] of set.pairs.slice(0, 3).entries()) {
    await expect(page.getByTestId('pair')).toHaveAttribute('data-pair-id', pair.id);
    for (const side of ['a', 'b'] as const) {
      const before = (await pageState(page)).events.length;
      await page.getByTestId(`play-${side}`).click();
      await expect.poll(async () => (await pageState(page)).events.length).toBe(before + 1);
      const event = (await pageState(page)).events.at(-1);
      expect(event?.codes).toEqual(pair[side]);
      // Back to back: each clip starts where the previous one ends (no gap, no overlap).
      const starts = event?.starts ?? [];
      const durations = event?.durations ?? [];
      expect(starts).toHaveLength(4);
      for (let k = 1; k < starts.length; k += 1) {
        expect(starts[k] ?? 0).toBeCloseTo((starts[k - 1] ?? 0) + (durations[k - 1] ?? 0), 6);
      }
    }
    await page.getByTestId(['choose-a', 'choose-b', 'choose-same'][i % 3] ?? 'choose-a').click();
  }
  expect((await pageState(page)).pairs).toEqual({
    [set.pairs[0]?.id ?? '']: 'a',
    [set.pairs[1]?.id ?? '']: 'b',
    [set.pairs[2]?.id ?? '']: 'same',
  });
});

test('pair choices survive a reload and the last one leads to the finish', async ({ page }) => {
  const set = await fetchSet(page, 'full');
  if (set.kind !== 'full') throw new Error('full set expected');
  for (let i = 0; i < 10; i += 1) await page.getByTestId('choose-b').click();
  await page.reload();
  await openPage(page);
  const s = await pageState(page);
  expect(s.phase).toBe('pairs');
  expect(s.index).toBe(10);
  expect(Object.values(s.pairs)).toEqual(Array<string>(10).fill('b'));
  for (let i = 10; i < 20; i += 1) await page.getByTestId('choose-a').click();
  expect((await pageState(page)).phase).toBe('done');
  await expect(page.getByTestId('download')).toBeEnabled();
});
