// axe-core on a whole page of the real apps (slice A-01-07 checkpoint 5): the WCAG 2.2 A and AA
// rules @shifa/ui's component tests use, plus the page-level rules a component cannot meet
// alone (one h1, one main, headings in order, everything inside a landmark).
import { createRequire } from 'node:module';
import { expect, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGE_RULES = ['page-has-heading-one', 'landmark-one-main', 'heading-order', 'region'];

interface Violation {
  id: string;
  targets: string[];
}

/** Fails, naming each rule and element, when axe finds a violation on the page as shown. */
export async function expectPageAxeClean(page: Page, what: string): Promise<void> {
  // Let fades and transitions end first: axe reads colours (as in @shifa/ui's helper).
  await page.evaluate(async () => {
    const ending = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.allSettled(ending.map((animation) => animation.finished));
  });
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(
    async ({ tags, rules }) => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              context: Document,
              options: unknown,
            ) => Promise<{
              violations: { id: string; nodes: { target: string[] }[] }[];
            }>;
          };
        }
      ).axe;
      const run = (options: unknown) => axe.run(document, options);
      // One run at a time: axe refuses a second while one is running.
      const wcag = await run({
        runOnly: { type: 'tag', values: tags },
        resultTypes: ['violations'],
      });
      const pageLevel = await run({
        runOnly: { type: 'rule', values: rules },
        resultTypes: ['violations'],
      });
      return [...wcag.violations, ...pageLevel.violations].map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target.join(' ')),
      }));
    },
    { tags: TAGS, rules: PAGE_RULES },
  );
  const lines = (violations as Violation[]).map((v) => `${v.id}: ${v.targets.join(', ')}`);
  expect(lines, `axe on ${what}`).toEqual([]);
}
