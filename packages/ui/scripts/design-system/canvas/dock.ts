// The playground of a sheet (ADR-0048): one live copy of the component and, at its right, a
// panel of its props built from the system's own controls (SegmentedControl, Select, Switch,
// Input, NumberInput, Button), so a viewer in Play switches a prop at once. The panel starts from
// the board's Tweaks (the saved, shared values) and keeps its changes in the board's state: they
// are the viewer's own and go on reload; «Reset» goes back to Tweaks. Scenarios set several props
// in one press; handlers make the copy behave as in the app (a press that waits for its request).
import { esc, type Mounts } from './page.ts';
import { type Control, type Option, PLAYGROUNDS, type Playground, tweakKey } from './playground.ts';
import type { SheetSpec } from './types.ts';

const NONE = '__none__';
const MUTED = 'color: var(--shifa-color-text-muted);';
const valueOf = (o: Option) => (typeof o === 'object' ? o.value : o);
const labelOf = (o: Option) => {
  const label = typeof o === 'object' ? o.label : String(o);
  return label === '' ? '—' : label;
};
const encode = (x: string | number) => (x === '' ? NONE : String(x));

/** Segmented for a few short choices, a Select otherwise. */
const segmented = (c: Control) =>
  (c.options ?? []).length <= 3 && (c.options ?? []).every((o) => labelOf(o).length <= 14);

/** The statements before `return` in renderVals(): the playground's state and readers. */
export const PRELUDE = `    const st = (this.state && this.state.pg) || {};
    const put = (k, x) => this.setState({ pg: { ...((this.state && this.state.pg) || {}), [k]: x } });
    const cur = (k, d) => (st[k] !== undefined ? st[k] : (p[k] ?? d));
    const enc = (x) => (x === '' || x === undefined || x === null ? '${NONE}' : String(x));`;

/** The playground's entries of renderVals()'s result: values, panel, scenarios, handlers. */
export function playgroundVals(spec: SheetSpec, vals: Record<string, unknown>): string {
  const playground = PLAYGROUNDS[spec.name];
  const controls = playground?.controls ?? [];
  const key = (c: Control) => JSON.stringify(tweakKey(c, controls));
  const read = (c: Control) => `cur(${key(c)}, ${JSON.stringify(c.default)})`;
  const data = (c: Control, i: number) => {
    const name = `d${String(i)}`;
    vals[name] = c.data;
    return `v.${name}[${read(c)}]`;
  };
  const pg = controls.map((c, i) => {
    const value =
      c.data !== undefined
        ? data(c, i)
        : c.editor === 'text' || c.editor === 'enum'
          ? `none(${read(c)})`
          : read(c);
    return `      c${String(i)}: ${value},`;
  });
  const dock = controls.map((c, i) => {
    const k = key(c);
    let entry: string;
    if (c.editor === 'boolean') entry = `{ on: ${read(c)} === true, set: (x) => put(${k}, x) }`;
    else if (c.editor === 'enum') {
      const raw = JSON.stringify((c.options ?? []).map(valueOf));
      entry = `{ value: enc(${read(c)}), set: (x) => put(${k}, ${raw}.find((o) => enc(o) === x)) }`;
    } else if (c.editor === 'int') {
      entry = `{ value: Number(${read(c)}), set: (x) => put(${k}, x === null ? 0 : x) }`;
    } else entry = `{ value: String(${read(c)} ?? ''), set: (x) => put(${k}, x) }`;
    return `        c${String(i)}: ${entry},`;
  });
  const scenarios = (playground?.scenarios ?? []).map(
    (s, i) => `        s${String(i)}: () => this.setState({ pg: ${JSON.stringify(s.set)} }),`,
  );
  const handlers = Object.entries(playground?.handlers ?? {}).map(
    ([prop, expr]) => `        ${prop}: ${expr},`,
  );
  const keyed = controls
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => playground?.remountAll === true || c.remount === true)
    .map(({ i }) => `pg.c${String(i)}`);
  const pgKey = keyed.length === 0 ? '' : `\n      pgKey: JSON.stringify([${keyed.join(', ')}]),`;
  return `    const pg = {
${pg.join('\n')}
    };
    return {
      pg,${pgKey}
      dk: {
${dock.join('\n')}
      },
      sc: {
${scenarios.join('\n')}
      },
      h: {
${handlers.join('\n')}
      },
      reset: () => this.setState({ pg: {} }),${pgKey}`;
}

/** The copy's holes: each control's value, the handlers, and the key that remounts it. */
function copyHoles(playground: Playground): Record<string, string> {
  const holes: Record<string, string> = Object.fromEntries(
    playground.controls.map((c, i) => [c.prop, `pg.c${String(i)}`]),
  );
  for (const prop of Object.keys(playground.handlers ?? {})) holes[prop] = `h.${prop}`;
  const remounts =
    playground.remountAll === true || playground.controls.some((c) => c.remount === true);
  if (remounts) holes['instanceKey'] = 'pgKey';
  return holes;
}

function control(c: Control, i: number, all: Control[], mounts: Mounts): string {
  const name = tweakKey(c, all);
  const path = `dk.c${String(i)}`;
  if (c.editor === 'boolean') {
    return mounts.tag(
      'Switch',
      { children: name },
      { checked: `${path}.on`, onCheckedChange: `${path}.set` },
    );
  }
  if (c.editor === 'enum') {
    const items = (c.options ?? []).map((o) => ({ value: encode(valueOf(o)), label: labelOf(o) }));
    if (segmented(c)) {
      return `<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0;"><span style="font-size: 13px; font-weight: 500; ${MUTED}">${esc(name)}</span>${mounts.tag(
        'SegmentedControl',
        { 'aria-label': name, items },
        { value: `${path}.value`, onValueChange: `${path}.set` },
      )}</div>`;
    }
    return mounts.tag(
      'Select',
      { label: name, items },
      { value: `${path}.value`, onValueChange: `${path}.set` },
    );
  }
  if (c.editor === 'int') {
    return mounts.tag(
      'NumberInput',
      { label: name },
      { value: `${path}.value`, onValueChange: `${path}.set` },
    );
  }
  return mounts.tag(
    'Input',
    { label: name, dir: 'auto' },
    { value: `${path}.value`, onValueChange: `${path}.set` },
  );
}

/** The playground section: the copy, and its panel at the right. */
export function playgroundSection(
  spec: SheetSpec,
  mounts: Mounts,
  frame: string,
  panel: string,
  strip: (title: string, note: string) => string,
): string {
  const playground = PLAYGROUNDS[spec.name];
  if (!playground) return '';
  const copy = mounts.tag(spec.name, playground.base, copyHoles(playground));
  const controls = playground.controls
    .map((c, i, all) => `          ${control(c, i, all, mounts)}`)
    .join('\n');
  const scenarios = (playground.scenarios ?? [])
    .map(
      (s, i) =>
        `            ${mounts.tag('Button', { children: s.label, size: 'sm' }, { onClick: `sc.s${String(i)}` })}`,
    )
    .join('\n');
  const scenarioBlock = scenarios
    ? `          <div style="display: flex; flex-direction: column; gap: 8px;">
            <span style="font-size: 13px; font-weight: 500; ${MUTED}">Scenarios</span>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
${scenarios}
            </div>
          </div>\n`
    : '';
  return `    <section data-playground style="${panel}">
${strip('Playground', 'Live in Play · switch its props at the right · saved defaults in Tweaks')}
      <div dir="ltr" style="display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: stretch;">
        <div${frame} style="display: flex; justify-content: center; align-items: center; min-height: 160px; padding: 24px; min-width: 0;">
          <div style="display: flex; flex-direction: column; align-items: ${spec.fill ? 'stretch' : 'center'}; width: ${spec.fill ? '560px' : 'auto'}; max-width: 100%;">${copy}</div>
        </div>
        <aside data-dock data-density="compact" dir="ltr" lang="en" style="display: flex; flex-direction: column; gap: 16px; min-width: 0; padding: 20px; border-radius: 12px; background: var(--shifa-color-bg-surface); border: 1px solid var(--shifa-color-border-default);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <strong style="font-size: 15px; font-weight: 600;">Props</strong>
            ${mounts.tag('Button', { children: 'Reset', variant: 'ghost', size: 'sm' }, { onClick: 'reset' })}
          </div>
${scenarioBlock}${controls}
          <p style="margin: 0; font-size: 12px; line-height: 1.5; ${MUTED}">Starts from Tweaks. What you change here is yours only and goes on reload.</p>
        </aside>
      </div>
    </section>`;
}
