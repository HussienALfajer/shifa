// Criterion 5: blind rating. Nothing on the page or on the wire names a provider or voice; every
// clip can be rated; a wrong mark and its note are kept; a reload keeps every answer; the finish
// downloads a results JSON with codes, scores and notes and no listener identity.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { listeningResultsSchema } from '@shifa-spike/s6-tts';
import { fetchSet, openPage, pageState, rateAllWithKeys, rateCurrent, readKey } from './helpers.ts';

// Provider and voice names, clip ids (number-011, name-m01, name-plain-f01, room-3), manifests.
const FORBIDDEN = [
  /fake/u,
  /azure/u,
  /google/u,
  /silma/u,
  /chirp/u,
  /laith/u,
  /amany/u,
  /number-\d/u,
  /name-(plain-)?[mf]\d/u,
  /room-\d/u,
  /manifest/u,
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
});

test('names no provider or voice in the DOM or in any request', async ({ page }) => {
  const seen: string[] = [];
  page.on('response', async (res) => {
    seen.push(res.url());
    const type = res.headers()['content-type'] ?? '';
    if (type.includes('json') || type.includes('html') || type.includes('javascript')) {
      seen.push(await res.text().catch(() => ''));
    }
  });
  await openPage(page);
  await rateCurrent(page, { score: 3 });
  await rateCurrent(page, { score: 4 });
  const dom = await page.content();
  for (const text of [dom, ...seen]) {
    const lower = text.toLowerCase();
    for (const word of FORBIDDEN) expect(lower, String(word)).not.toMatch(word);
  }
});

test('every clip can be rated, then the pairs open', async ({ page }) => {
  const set = await fetchSet(page, 'full');
  if (set.kind !== 'full') throw new Error('full set expected');
  await openPage(page);
  const start = await pageState(page);
  expect(start.phase).toBe('rating');
  expect(start.total).toBe(set.items.length);
  // The intended text is shown for numbers and names only.
  for (let i = 0; i < 6; i += 1) {
    const s = await pageState(page);
    const item = set.items[s.index];
    const shown = page.getByTestId('text');
    if (item?.text === undefined) await expect(shown).toBeHidden();
    else await expect(shown).toHaveText(item.text);
    await rateCurrent(page, { score: 1 + (i % 5) });
  }
  await rateAllWithKeys(page, 4);
  const done = await pageState(page);
  expect(done.phase).toBe('pairs');
  expect(Object.keys(done.ratings).sort()).toEqual(set.items.map((i) => i.code).sort());
  // Every clip was played before it was rated.
  const played = new Set(done.events.flatMap((e) => (e.codes.length === 1 ? e.codes : [])));
  for (const item of set.items) expect(played.has(item.code), item.code).toBe(true);
});

test('keeps a wrong mark and its note', async ({ page }) => {
  const set = await fetchSet(page, 'full');
  if (set.kind !== 'full') throw new Error('full set expected');
  await openPage(page);
  // Skip to the first judged clip.
  while (set.items[(await pageState(page)).index]?.text === undefined) {
    await rateCurrent(page, { score: 3 });
  }
  const { index } = await pageState(page);
  const code = set.items[index]?.code ?? '';
  await rateCurrent(page, { score: 2, wrong: true, note: 'قال مئة وواحد' });
  expect((await pageState(page)).ratings[code]).toEqual({
    naturalness: 2,
    wrong: true,
    note: 'قال مئة وواحد',
  });
  // Going back shows the saved answer.
  await page.getByTestId('prev').click();
  await expect(page.getByTestId('note')).toHaveValue('قال مئة وواحد');
  await expect(page.getByTestId('wrong')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('score-2')).toHaveAttribute('aria-pressed', 'true');
});

test('a reload mid-run keeps every answer and the position', async ({ page }) => {
  await openPage(page);
  for (let i = 0; i < 5; i += 1) await rateCurrent(page, { score: 5, note: `n${String(i)}` });
  const before = await pageState(page);
  await page.reload();
  await openPage(page);
  const after = await pageState(page);
  expect(after.index).toBe(5);
  expect(after.ratings).toEqual(before.ratings);
  expect(Object.keys(after.ratings)).toHaveLength(5);
});

test('finish downloads a valid results JSON with no identity field', async ({ page }) => {
  const set = await fetchSet(page, 'full');
  const key = readKey('full');
  await openPage(page);
  await rateAllWithKeys(page, 3);
  if (set.kind !== 'full') throw new Error('full set expected');
  for (let i = 0; i < set.pairs.length; i += 1) {
    await page.getByTestId('choose-same').click();
  }
  expect((await pageState(page)).phase).toBe('done');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download').click(),
  ]);
  expect(download.suggestedFilename()).toBe(`s6-results-${set.setHash}.json`);
  const path = await download.path();
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  // Strict schema: an unknown field (a name, an e-mail, a device id) fails the parse.
  const results = listeningResultsSchema.parse(raw);
  expect(results.setHash).toBe(key.setHash);
  expect(results.ratings).toHaveLength(set.items.length);
  expect(results.pairs).toHaveLength(set.pairs.length);
  expect(Object.keys(raw).sort()).toEqual(
    ['finishedAt', 'kind', 'pairs', 'ratings', 'schemaVersion', 'setHash', 'startedAt'].sort(),
  );
});
