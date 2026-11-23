// One screenshot per story of the built Storybook. Each story already shows the eight
// combinations of direction × theme × density (.storybook/matrix.tsx). Stories with a play
// function are left to the Storybook test run: their end state is focus, not a picture.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

interface Entry {
  id: string;
  type: 'story' | 'docs';
  importPath: string;
  tags?: string[];
}

const index = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'storybook-static', 'index.json'), 'utf8'),
) as { entries: Record<string, Entry> };

const stories = Object.values(index.entries).filter(
  (e) => e.type === 'story' && !(e.tags ?? []).includes('play-fn'),
);

test('the built Storybook has stories', () => {
  expect(stories.length).toBeGreaterThan(0);
});

// Autodocs (preview.tsx): one docs page per stories file, all 37 components (spec 0.4 criterion
// 9). Docs pages get no screenshot; each of their stories already has one.
test('the built Storybook has one docs page per stories file', () => {
  const entries = Object.values(index.entries);
  const files = new Set(entries.map((e) => e.importPath));
  const docs = entries.filter((e) => e.type === 'docs');
  expect(files.size).toBe(37);
  expect(docs).toHaveLength(37);
  expect(new Set(docs.map((e) => e.importPath))).toEqual(files);
});

for (const story of stories) {
  test(story.id, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    await page.locator('#storybook-root > *').first().waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: true });
  });
}
