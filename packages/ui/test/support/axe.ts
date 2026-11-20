// axe-core on a rendered region, with the WCAG 2.2 A and AA rules (spec 0.4 criteria 7–9).
// Page-level best practices (landmarks, one h1) do not apply to a component and are left out.
import axe from 'axe-core';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Throws, naming each rule and element, when axe finds a violation inside `container`. */
export async function expectAxeClean(container: Element): Promise<void> {
  // Popups fade in and colours transition: axe reads colours, so let running animations and
  // transitions end first (under load it caught a calendar and a dialog mid-fade; slice 0.4-05).
  // A spinner runs forever: wait only for animations that end.
  const ending = document
    .getAnimations()
    .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
  await Promise.allSettled(ending.map((animation) => animation.finished));
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: TAGS },
    resultTypes: ['violations'],
  });
  if (results.violations.length === 0) return;
  const lines = results.violations.map(
    (v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  throw new Error(
    `axe found ${String(results.violations.length)} violation(s):\n${lines.join('\n')}`,
  );
}
