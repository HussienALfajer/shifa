// The "Shifa Components" canvas generator (ADR-0048): every board builds, its logic class runs as
// the canvas runs it, every `{{ }}` hole resolves, the playground panel drives the copy, and the
// fixed states reach only the elements a frame names.
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { makeBoard } from '../scripts/design-system/canvas/board.ts';
import { PLAYGROUNDS, tweakKey } from '../scripts/design-system/canvas/playground.ts';
import { SHEETS } from '../scripts/design-system/canvas/sheets.ts';
import { forcedStates, NTH } from '../scripts/design-system/canvas/states.ts';

type Vals = Record<string, unknown>;

/** The board's logic class run as the canvas runs it, with Tweaks `props` and panel `state`. */
function run(html: string, props: Vals = {}, state: Vals = {}): Vals {
  const src = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  class DCLogic {
    props = props;
    state = state;
    setState(next: Vals) {
      this.state = { ...this.state, ...next };
    }
  }
  // The board's own logic class, as the canvas runs it.
  const Logic = runInNewContext(
    `(${src.replace('class Component extends DCLogic', 'class extends DCLogic')})`,
    { DCLogic, JSON, Object, Array, Number, String, setTimeout, Promise },
  ) as new () => { renderVals: () => Vals };
  return new Logic().renderVals();
}

const at = (vals: Vals, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v as Vals | undefined)?.[k], vals);

describe('components canvas', () => {
  it('builds every board, and every hole of it resolves', () => {
    for (const spec of SHEETS) {
      const html = makeBoard(spec, 1200);
      const vals = run(html);
      const holes = [...html.matchAll(/\{\{\s*([\w.$]+)\s*\}\}/g)].map((m) => m[1] ?? '');
      for (const path of new Set(holes)) {
        if (path === 'true' || path === 'false') continue;
        const [head] = path.split('.');
        expect(head !== undefined && head in vals, `${spec.name}: {{ ${path} }}`).toBe(true);
      }
    }
  });

  it('gives every playground a panel at the right that drives its copy', () => {
    for (const spec of SHEETS) {
      const playground = PLAYGROUNDS[spec.name];
      if (!playground || playground.controls.length === 0) continue;
      const html = makeBoard(spec, 1200);
      expect(html, spec.name).toContain('data-dock');
      const first = playground.controls[0];
      if (first === undefined) continue;
      const key = tweakKey(first, playground.controls);
      const before = run(html);
      const dock = at(before, 'dk.c0') as { set: (x: unknown) => void } | undefined;
      expect(typeof dock?.set, `${spec.name}: dk.c0.set`).toBe('function');
      // A panel change wins over Tweaks; «Reset» goes back to them.
      const picked =
        first.editor === 'boolean' ? first.default !== true : first.editor === 'int' ? 7 : 'x';
      const value = first.data ? Object.keys(first.data).at(-1) : picked;
      const after = run(html, { [key]: first.default }, { pg: { [key]: value } });
      const expected = first.data ? (first.data as Vals)[String(value)] : value;
      expect(at(after, 'pg.c0'), spec.name).toEqual(expected === '' ? undefined : expected);
    }
  });

  it('remounts the copy when a prop read once changes', () => {
    const spec = SHEETS.find((s) => s.name === 'Switch');
    if (!spec) throw new Error('no Switch sheet');
    const html = makeBoard(spec, 1200);
    expect(html).toContain('instance-key="{{ pgKey }}"');
    const off = run(html, { defaultChecked: false });
    const on = run(html, { defaultChecked: true });
    expect(off['pgKey']).not.toEqual(on['pgKey']);
  });

  it('copies each state rule for the plain, outer and nth frames', () => {
    const css = forcedStates(
      '@layer utilities{.box:hover{color:red}.box .eye:hover{color:blue}.tab:focus-visible{outline:2px}}',
    );
    expect(css).toContain(
      '[data-pseudo~="hover"]:not([data-pseudo-outer]):not([data-pseudo-nth]) .box:is(*)',
    );
    expect(css).toMatch(/\[data-pseudo~="hover"\]\[data-pseudo-outer\] \.box:is\(\*\):not\(:is\(/);
    expect(css).toContain(
      '[data-pseudo~="focus"][data-pseudo-nth="2"]:not([data-pseudo-in]) .tab:is(*):nth-child(2 of .tab:is(*))',
    );
    expect(css).toContain(
      '[data-pseudo~="focus"][data-pseudo-in="tablist"][data-pseudo-nth="2"] [role="tablist"] > :nth-child(2) .tab:is(*)',
    );
    expect(css).toContain(`[data-pseudo-nth="${String(NTH)}"]`);
  });
});
