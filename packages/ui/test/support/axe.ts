// axe-core on a rendered region, with the WCAG 2.2 A and AA rules (spec 0.4 criteria 7–9).
// Page-level best practices (landmarks, one h1) do not apply to a component and are left out.
import axe from 'axe-core';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Throws, naming each rule and element, when axe finds a violation inside `container`. */
export async function expectAxeClean(container: Element): Promise<void> {
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
