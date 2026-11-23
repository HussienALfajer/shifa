// One screenshot per story of the built Storybook. Each story already shows the eight
// combinations of direction × theme × density (.storybook/matrix.tsx). Stories with a play
// function are left to the Storybook test run: their end state is focus, not a picture.
import { readdirSync, readFileSync } from 'node:fs';
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

const listStories = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listStories(join(dir, e.name))
      : e.name.endsWith('.stories.tsx')
        ? [e.name]
        : [],
  );
const docs = Object.values(index.entries).filter((e) => e.type === 'docs');

// Autodocs (preview.tsx): one docs page per stories file, every component (spec 0.4 criterion
// 9). Docs pages get no screenshot; each of their stories already has one.
test('the built Storybook has one docs page per stories file', () => {
  const onDisk = listStories(join(import.meta.dirname, '..', 'src'));
  const entries = Object.values(index.entries);
  const files = new Set(entries.map((e) => e.importPath));
  expect(onDisk.length).toBeGreaterThan(0);
  expect(files.size).toBe(onDisk.length);
  expect(docs).toHaveLength(onDisk.length);
  expect(new Set(docs.map((e) => e.importPath))).toEqual(files);
});

// A reader can reach the notes: no story opens a modal over the docs page (a modal story renders
// in its own frame, `parameters.docs.story.inline: false`), so the accessibility paragraph is
// visible and neither inert nor hidden from screen readers.
for (const entry of docs) {
  test(`${entry.id}: the accessibility notes can be read`, async ({ page }) => {
    // A docs page whose stories render in their own frames (`inline: false`: the command palette
    // has ten, about 900 requests through the browser's connection) takes several seconds to go
    // idle, and under four parallel workers it ran past the 30 s default (CI, 2026-11-23, on
    // `main` too). Three times the limit; what the test checks is unchanged.
    test.slow();
    await page.goto(`/iframe.html?id=${entry.id}&viewMode=docs`);
    await page.locator('.docs-story').first().waitFor();
    await page.waitForLoadState('networkidle');
    const notes = page.getByText('Accessibility.', { exact: true }).first();
    await expect(notes).toBeVisible();
    expect(await notes.evaluate((el) => el.closest('[inert], [aria-hidden="true"]'))).toBeNull();
    await expect(page.locator('[aria-modal="true"]:visible')).toHaveCount(0);
  });
}

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
