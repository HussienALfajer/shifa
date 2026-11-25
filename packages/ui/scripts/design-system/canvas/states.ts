// `support/states.css` from the system's `bundle.css`: every rule that depends on :hover, :active
// or :focus(-visible) is copied with that pseudo-class satisfied by an ancestor attribute,
// data-pseudo="hover" | "hover active" | "focus", so a sheet can show those states at rest. Same
// declarations, same layer, same order; only the trigger changes.
//
// A frame forces the state on every element inside it, which is right for a plain control and
// wrong for one with an inner button (a password's eye, a number's steppers): the pointer on the
// field does not hover the steppers. Two narrower frames:
// - `data-pseudo-outer`: only the outermost elements that have a rule for the state, not the
//   elements inside them (the field box, not its eye);
// - `data-pseudo-nth="N"` (1 to NTH): only the Nth of sibling elements that have a rule for the
//   state (the second tab of a tab list).
import postcss, { type Rule } from 'postcss';

const STATES = {
  hover: /(?<!\\):hover(?![-\w])/g,
  active: /(?<!\\):active(?![-\w])/g,
  focus: /(?<!\\):focus(?:-visible)?(?![-\w])/g,
};
type State = keyof typeof STATES;

/** The highest sibling a `data-pseudo-nth` frame can pick. */
export const NTH = 4;

/**
 * Containers whose items a frame can pick with `data-pseudo-in="<role>"` and `data-pseudo-nth`:
 * the Nth child of the `[role]` element, and what is inside it (one tab, one radio row).
 */
export const ROLES = ['tablist', 'radiogroup', 'group', 'toolbar'] as const;

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

interface Found {
  rule: Rule;
  layer: string | null;
  state: State;
  /** The rule's selectors that use the state, with the pseudo-class satisfied (`:is(*)`). */
  selectors: string[];
}

export function forcedStates(bundleCss: string): string {
  const root = postcss.parse(bundleCss);
  const found: Found[] = [];
  root.walkRules((rule) => {
    if (rule.parent?.type === 'rule') return;
    const layer = layerOf(rule);
    if (layer === undefined) return;
    for (const [state, re] of Object.entries(STATES) as [State, RegExp][]) {
      const selectors = rule.selectors
        .filter((s) => s.match(re))
        .map((s) => s.replace(re, ':is(*)'));
      if (selectors.length > 0) found.push({ rule, layer, state, selectors });
    }
  });
  // Every element with a rule for the state, for the narrower frames.
  const subjects = (state: State) =>
    found.filter((f) => f.state === state).flatMap((f) => f.selectors);
  const any: Record<State, string> = {
    hover: subjects('hover').join(','),
    active: subjects('active').join(','),
    focus: subjects('focus').join(','),
  };
  const byLayer = new Map<string | null, string[]>();
  for (const { rule, layer, state, selectors } of found) {
    const frame = `[data-pseudo~="${state}"]`;
    // One rule per frame: a selector the browser refuses drops only its own rule.
    const nths = Array.from({ length: NTH }, (_, i) => String(i + 1));
    const variants = [
      selectors.map((s) => `${frame}:not([data-pseudo-outer]):not([data-pseudo-nth]) ${s}`),
      selectors.map((s) => `${frame}[data-pseudo-outer] ${s}:not(:is(${any[state]}) *)`),
      ...nths.map((n) =>
        selectors.map(
          (s) =>
            `${frame}[data-pseudo-nth="${n}"]:not([data-pseudo-in]) ${s}:nth-child(${n} of ${s})`,
        ),
      ),
      ...ROLES.flatMap((role) =>
        nths.map((n) => {
          const item = `${frame}[data-pseudo-in="${role}"][data-pseudo-nth="${n}"] [role="${role}"] > :nth-child(${n})`;
          return selectors.flatMap((s) => [`${item}:is(${s})`, `${item} ${s}`]);
        }),
      ),
    ];
    const rules = byLayer.get(layer) ?? [];
    for (const list of variants) rules.push(rule.clone({ selector: list.join(',') }).toString());
    byLayer.set(layer, rules);
  }
  let css =
    '/* Generated from the Shifa Design System bundle.css (hover, pressed and focus shown at rest). Do not edit. */\n';
  for (const [layer, rules] of byLayer) {
    css += layer ? `@layer ${layer}{\n${rules.join('\n')}\n}\n` : `${rules.join('\n')}\n`;
  }
  return css;
}
