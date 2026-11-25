// The tweak combinations check.ts opens for a board: every value of each Display tweak (view,
// theme, density, direction) with the playground at its defaults, and one more with the
// playground's props changed (each boolean flipped, each choice its last option).

interface Declared {
  editor?: string;
  default?: unknown;
  options?: unknown[];
  section?: string;
}
export type Tweaks = Record<string, Declared>;

export interface Combination {
  name: string;
  props: Record<string, unknown>;
  /** The sheet is shown (not an open view): its natural height counts for the board's. */
  sheet: boolean;
}

const valueOf = (o: unknown) => (o !== null && typeof o === 'object' && 'value' in o ? o.value : o);

export function combinations(tweaks: Tweaks): Combination[] {
  const display = Object.entries(tweaks).filter(([, t]) => t.section === 'Display');
  let combos: Record<string, unknown>[] = [{}];
  for (const [name, t] of display) {
    const values = (t.options ?? [t.default]).map(valueOf);
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [name]: v })));
  }
  // Without a view tweak a board is its sheet; with one, only the value `sheet` shows it.
  const isSheet = (p: Record<string, unknown>) =>
    tweaks['view'] === undefined || p['view'] === 'sheet';
  const out: Combination[] = combos.map((props) => ({
    name: Object.values(props).join('/'),
    props,
    sheet: isSheet(props),
  }));
  const changed: Record<string, unknown> = {};
  for (const [name, t] of Object.entries(tweaks)) {
    if (t.section !== 'Playground') continue;
    if (t.editor === 'boolean') changed[name] = t.default !== true;
    else if (t.editor === 'enum' && t.options && t.options.length > 0)
      changed[name] = valueOf(t.options.at(-1));
    else if (t.editor === 'int') changed[name] = Number(t.default ?? 1) * 2;
  }
  if (Object.keys(changed).length > 0) {
    const props = tweaks['view'] ? { view: 'sheet', ...changed } : changed;
    out.push({ name: 'playground changed', props, sheet: true });
  }
  return out;
}
