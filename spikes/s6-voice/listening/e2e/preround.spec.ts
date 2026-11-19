// Criterion 2: the pre-round. Six Chirp voices under neutral labels (صوت ١ … صوت ٦), five phrases
// each; the owner picks one male and one female; the choice downloads only after both are picked.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { preRoundChoiceSchema } from '@shifa-spike/s6-tts';
import { fetchSet, openPage, pageState, readKey } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
});

test('shows six voices under neutral labels with five phrases each', async ({ page }) => {
  const set = await fetchSet(page, 'pre-round');
  if (set.kind !== 'pre-round') throw new Error('pre-round set expected');
  await openPage(page, '?mode=pre-round');
  expect((await pageState(page)).phase).toBe('pre-round');
  const labels = ['صوت ١', 'صوت ٢', 'صوت ٣', 'صوت ٤', 'صوت ٥', 'صوت ٦'];
  for (const [i, label] of labels.entries()) {
    const card = page.getByTestId(`voice-${String(i + 1)}`);
    await expect(card.getByRole('heading')).toHaveText(label);
    await expect(card.getByRole('button', { name: /استمع/u })).toHaveCount(5);
  }
  const dom = (await page.content()).toLowerCase();
  for (const word of ['chirp', 'google', 'fake', 'orus', 'leda', 'kore']) {
    expect(dom).not.toContain(word);
  }
  // A phrase plays its own clip.
  const first = set.voices[0]?.clips[0];
  await page.getByTestId('play-1-1').click();
  await expect
    .poll(async () => (await pageState(page)).events.at(-1)?.codes)
    .toEqual([first?.code]);
});

test('downloads the choice only after one male and one female are picked', async ({ page }) => {
  const set = await fetchSet(page, 'pre-round');
  if (set.kind !== 'pre-round') throw new Error('pre-round set expected');
  const key = readKey('pre-round');
  await openPage(page, '?mode=pre-round');
  const download = page.getByTestId('download-choice');
  await expect(download).toBeDisabled();

  const males = set.voices.filter((v) => v.gender === 'male');
  const females = set.voices.filter((v) => v.gender === 'female');
  expect(males).toHaveLength(3);
  expect(females).toHaveLength(3);

  await page.getByTestId(`pick-${String(males[0]?.label)}`).click();
  await expect(download).toBeDisabled();
  // Picking a second male replaces the first.
  await page.getByTestId(`pick-${String(males[1]?.label)}`).click();
  await expect(download).toBeDisabled();
  await page.getByTestId(`pick-${String(females[2]?.label)}`).click();
  await expect(download).toBeEnabled();

  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(file.suggestedFilename()).toBe('pre-round-choice.json');
  const choice = preRoundChoiceSchema.parse(
    JSON.parse(readFileSync(await file.path(), 'utf8')) as unknown,
  );
  expect(choice.setHash).toBe(key.setHash);
  expect(choice.male).toBe(males[1]?.label);
  expect(choice.female).toBe(females[2]?.label);
});
