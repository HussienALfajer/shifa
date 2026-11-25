// `support/states.css` from the system's `bundle.css`: every rule that depends on :hover, :active
// or :focus(-visible) is copied with that pseudo-class satisfied by an ancestor attribute,
// data-pseudo="hover" | "hover active" | "focus", so a sheet can show those states at rest. Same
// declarations, same layer, same order; only the trigger changes.
import postcss, { type Rule } from 'postcss';

const STATES = {
  hover: /(?<!\\):hover(?![-\w])/g,
  active: /(?<!\\):active(?![-\w])/g,
  focus: /(?<!\\):focus(?:-visible)?(?![-\w])/g,
};

/** The layer a rule sits in, or undefined when it sits in a block we leave out. */
function layerOf(rule: Rule): string | null | undefined {
  let layer: string | null = null;
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type !== 'atrule') continue;
    const at = p as unknown as { name: string; params: string };
    if (at.name === 'layer') layer = at.params;
    // Plain and (hover: hover) rules only; never keyframes.
    if ((at.name === 'media' && !at.params.includes('hover')) || at.name === 'keyframes')
      return undefined;
  }
  return layer;
}

export function forcedStates(bundleCss: string): string {
  const root = postcss.parse(bundleCss);
  const byLayer = new Map<string | null, string[]>();
  root.walkRules((rule) => {
    if (rule.parent?.type === 'rule') return;
    const layer = layerOf(rule);
    if (layer === undefined) return;
    for (const [state, re] of Object.entries(STATES)) {
      const selectors = rule.selectors.filter((s) => s.match(re));
      if (selectors.length === 0) continue;
      const forced = selectors.map((s) => `[data-pseudo~="${state}"] ${s.replace(re, ':is(*)')}`);
      const rules = byLayer.get(layer) ?? [];
      rules.push(rule.clone({ selector: forced.join(',') }).toString());
      byLayer.set(layer, rules);
    }
  });
  let css =
    '/* Generated from the Shifa Design System bundle.css (hover, pressed and focus shown at rest). Do not edit. */\n';
  for (const [layer, rules] of byLayer) {
    css += layer ? `@layer ${layer}{\n${rules.join('\n')}\n}\n` : `${rules.join('\n')}\n`;
  }
  return css;
}
