// One board per component of the "Shifa Components" canvas (ADR-0048): on top a playground (one
// live copy whose props are tweaks), below every variant, size and state in one panel; theme,
// density and direction are tweaks of the whole board, and an overlay's open views replace the
// sheet when Tweaks' `view` asks for one. Every copy is the real component of the bundle.
import { PRELUDE, playgroundSection, playgroundVals } from './dock.ts';
import { esc, Mounts, page, type TweakDef, WIDTH } from './page.ts';
import { PLAYGROUNDS, tweakKey } from './playground.ts';
import { NTH } from './states.ts';
import type { Block, Item, OpenView, SheetSpec } from './types.ts';

const MUTED = 'color: var(--shifa-color-text-muted);';
const PSEUDO = { hover: 'hover', pressed: 'hover active', focus: 'focus' } as const;
const DISPLAY = 'Display';
const PLAY = 'Playground';

/** Every copy of a sheet in order (matrix cells too), for pairing the two densities' captions. */
const flat = (blocks: Block[]): Item[] =>
  blocks.flatMap((b) => ('matrix' in b ? b.matrix.rows.flatMap((r) => r.cells) : b.items));

/** The board's tweaks: display first, then the playground's props. */
export function boardTweaks(spec: SheetSpec): Record<string, TweakDef> {
  const tweaks: Record<string, TweakDef> = {
    theme: {
      editor: 'enum',
      default: 'light',
      options: [
        { value: 'light', label: 'فاتح' },
        { value: 'dark', label: 'داكن' },
      ],
      section: DISPLAY,
    },
  };
  if (spec.density !== false) {
    tweaks['density'] = {
      editor: 'enum',
      default: 'comfortable',
      options: [
        { value: 'comfortable', label: 'مريح' },
        { value: 'compact', label: 'مضغوط' },
      ],
      section: DISPLAY,
    };
  }
  tweaks['direction'] = {
    editor: 'enum',
    default: 'rtl',
    options: [
      { value: 'rtl', label: 'عربي · من اليمين' },
      { value: 'ltr', label: 'English · LTR' },
    ],
    section: DISPLAY,
  };
  const views = viewOptions(spec);
  if (views.length > 1) {
    tweaks['view'] = { editor: 'enum', default: views[0]?.value, options: views, section: DISPLAY };
  }
  const controls = PLAYGROUNDS[spec.name]?.controls ?? [];
  for (const c of controls) {
    tweaks[tweakKey(c, controls)] = {
      editor: c.editor,
      default: c.default,
      ...(c.options ? { options: c.options } : {}),
      section: PLAY,
    };
  }
  return tweaks;
}

/** The sheet (unless the component has only open views), then each open view. */
export const viewOptions = (spec: SheetSpec) => [
  ...(spec.openOnly ? [] : [{ value: 'sheet', label: 'الورقة' }]),
  ...(spec.open ?? []).map((o) => ({ value: o.suffix, label: o.label })),
];

function logic(
  spec: SheetSpec,
  vals: Record<string, unknown>,
  caps: Record<string, [string, string]>,
): string {
  const first = viewOptions(spec)[0]?.value ?? 'sheet';
  // Before `vals` is written: a data control adds its data to them.
  const playground = playgroundVals(spec, vals);
  const compactCaps = Object.fromEntries(Object.entries(caps).map(([k, [, c]]) => [k, c]));
  const comfortableCaps = Object.fromEntries(Object.entries(caps).map(([k, [c]]) => [k, c]));
  const opens = (spec.open ?? [])
    .map((o) => `      is${o.suffix}: view === ${JSON.stringify(o.suffix)},`)
    .join('\n');
  return `    const p = this.props;
    const theme = p.theme ?? 'light';
    const density = ${spec.density === false ? "'comfortable'" : "p.density ?? 'comfortable'"};
    const dir = p.direction ?? 'rtl';
    const view = p.view ?? ${JSON.stringify(first)};
    const none = (x) => (x === '' ? undefined : x);
    const v = ${JSON.stringify(vals)};
${PRELUDE}
${playground}
      v,
      theme,
      density,
      dir,
      lang: dir === 'rtl' ? 'ar' : 'en',
      line: (theme === 'dark' ? 'Dark' : 'Light') + ' · ' + density + ' · ' + (dir === 'rtl' ? 'Arabic, right to left' : 'English, left to right'),
      note: density === 'compact' ? 'pointer devices only · 32 px controls and rows' : ${JSON.stringify(spec.density === false ? 'the same in both densities' : 'touch and pointer · 44 px controls, 48 px rows')},
      caps: density === 'compact' ? ${JSON.stringify(compactCaps)} : ${JSON.stringify(comfortableCaps)},
      isSheet: view === 'sheet',
${opens}
    };`;
}

/** The attributes that put a section in the board's theme, density and direction. */
const frame = (spec: SheetSpec) =>
  `${spec.density === false ? '' : ' data-density="{{ density }}"'} dir="{{ dir }}" lang="{{ lang }}"`;
const PANEL = `display: flex; flex-direction: column; gap: 24px; min-width: 0; padding: 24px; border-radius: 16px; background: var(--shifa-color-bg-app); color: var(--shifa-color-text-default); border: 1px solid var(--shifa-color-border-default);`;
const strip = (
  title: string,
  note: string,
) => `      <div dir="ltr" style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--shifa-color-border-default);">
        <strong style="font-size: 16px; font-weight: 600;">${title}</strong>
        <span style="font-size: 12px; ${MUTED}">${note}</span>
      </div>`;

/** The frame that fixes a copy's hover, pressed or focus, on what its `scope` names (states.ts). */
function pseudoFrame(name: string, it: Item, slot: string, seen: { scoped: boolean }): string {
  const nth =
    typeof it.scope === 'number' ? it.scope : typeof it.scope === 'object' ? it.scope.nth : 0;
  if (nth > NTH) throw new Error(`${name}: scope ${String(nth)} > ${String(NTH)}`);
  if (nth > 0) seen.scoped = true;
  let attrs = '';
  if (it.scope === 'outer') attrs = ' data-pseudo-outer';
  else if (typeof it.scope === 'number') attrs = ` data-pseudo-nth="${String(it.scope)}"`;
  else if (typeof it.scope === 'object')
    attrs = ` data-pseudo-in="${it.scope.role}" data-pseudo-nth="${String(it.scope.nth)}"`;
  const pseudo = it.pseudo ? PSEUDO[it.pseudo] : '';
  return `<div data-pseudo="${pseudo}"${attrs} style="display: block; min-width: 0;">${slot}</div>`;
}

function sheetBody(spec: SheetSpec, mounts: Mounts, caps: Record<string, [string, string]>) {
  // Set by the copies below as they are written (an object: TS does not follow closures).
  const seen = { pseudo: false, scoped: false };
  const alt = flat(spec.density === false ? spec.blocks('comfortable') : spec.blocks('compact'));
  let index = 0;
  const item = (it: Item, ind: string) => {
    const twin = alt[index];
    index += 1;
    if (JSON.stringify(twin?.p) !== JSON.stringify(it.p)) {
      throw new Error(`${spec.name}: the densities show different copies`);
    }
    let slot = mounts.tag(it.c ?? spec.name, it.p);
    if (it.pseudo) {
      seen.pseudo = true;
      slot = pseudoFrame(spec.name, it, slot, seen);
    }
    const width = it.w ? `width: ${String(it.w)}px; max-width: 100%;` : 'min-width: 0;';
    const dir = it.dir ? ` dir="${it.dir}"` : '';
    let capText = it.cap ? esc(it.cap) : '';
    if (it.cap && twin?.cap && twin.cap !== it.cap) {
      const key = `c${String(Object.keys(caps).length)}`;
      caps[key] = [it.cap, twin.cap];
      capText = `{{ caps.${key} }}`;
    }
    const cap = capText
      ? `\n${ind}  <span style="font-size: 12px; line-height: 1.4; ${MUTED}" dir="ltr">${capText}</span>`
      : '';
    const align = spec.fill ? 'stretch' : 'flex-start';
    return `${ind}<div${dir} style="display: flex; flex-direction: column; gap: 8px; align-items: ${align}; ${width}">\n${ind}  ${slot}${cap}\n${ind}</div>`;
  };
  const block = (b: Block, ind: string) => {
    const label = `${ind}<p style="margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; ${MUTED}" dir="ltr">${esc(b.label)}</p>`;
    if ('matrix' in b) {
      const m = b.matrix;
      const cols = `grid-template-columns: 96px repeat(${String(m.cols.length)}, minmax(0, 1fr));`;
      const head = [
        `${ind}  <span></span>`,
        ...m.cols.map(
          (c) => `${ind}  <span style="font-size: 12px; ${MUTED}" dir="ltr">${esc(c)}</span>`,
        ),
      ].join('\n');
      const rows = m.rows
        .map((r) =>
          [
            `${ind}  <span style="font-size: 13px; font-weight: 500; ${MUTED}" dir="ltr">${esc(r.head)}</span>`,
            ...r.cells.map((cell) => item(cell, `${ind}  `)),
          ].join('\n'),
        )
        .join('\n');
      return `${ind}<div style="display: flex; flex-direction: column; gap: 12px;">\n${label}\n${ind}<div style="display: grid; ${cols} gap: 16px 12px; align-items: center;">\n${head}\n${rows}\n${ind}</div>\n${ind}</div>`;
    }
    const layout = b.cols
      ? `display: grid; grid-template-columns: repeat(${String(b.cols)}, minmax(0, 1fr)); gap: 20px 24px; align-items: start;`
      : 'display: flex; flex-wrap: wrap; gap: 20px 24px; align-items: flex-start;';
    return `${ind}<div style="display: flex; flex-direction: column; gap: 12px;">\n${label}\n${ind}<div style="${layout}">\n${b.items.map((it) => item(it, `${ind}  `)).join('\n')}\n${ind}</div>\n${ind}</div>`;
  };
  const blocks = spec
    .blocks('comfortable')
    .map((b) => block(b, '      '))
    .join('\n');
  const live = playgroundSection(spec, mounts, frame(spec), PANEL, strip);
  const notes: string[] = [];
  if (seen.pseudo) {
    notes.push(
      'Hover, pressed and keyboard focus copies are fixed for display: the component’s own :hover, :active and :focus-visible rules, switched on by the frame around it. Every other copy is live.',
    );
  }
  if (spec.density === false)
    notes.push('This component has no compact values, so it has no density tweak.');
  if (spec.open)
    notes.push('Its open views are in Tweaks › View; each shows the overlay open over the board.');
  if (seen.scoped)
    notes.push(
      'A copy that names one item («the second», «+ hovered») has the state on that item only, as the pointer or Tab would put it.',
    );
  return `    <div style="box-sizing: border-box; padding: 56px 64px; display: flex; flex-direction: column; gap: 28px;">
  <div dir="ltr" style="display: flex; justify-content: space-between; gap: 48px; align-items: flex-end;">
    <div style="display: flex; flex-direction: column; gap: 8px; max-width: 820px;">
      <p style="margin: 0; font-size: 14px; font-weight: 500; ${MUTED}">${esc(spec.group.toUpperCase())} · COMPONENT</p>
      <h1 style="margin: 0; font-size: 31px; line-height: 1.3; font-weight: 600;">${esc(spec.name)}</h1>
      <p style="margin: 0; font-size: 16px; line-height: 1.6; ${MUTED}">${esc(spec.desc)}</p>
    </div>
    <div style="flex: none; width: 360px; display: flex; flex-direction: column; gap: 6px; padding: 16px 20px; border-radius: 12px; background: var(--shifa-color-bg-app); border: 1px solid var(--shifa-color-border-default);">
      <span style="font-size: 13px; font-weight: 600;">The real component</span>
      <code style="font-size: 13px; font-family: var(--font-mono);">Shifa.${esc(spec.name)}</code>
      <span style="font-size: 13px; line-height: 1.5; ${MUTED}">In Play: ${esc(spec.play)} The playground’s props: its panel at the right; theme, density, direction and saved defaults: Tweaks.</span>
    </div>
  </div>
${live}
    <section data-panel${frame(spec)} style="${PANEL}">
${strip('{{ line }}', '{{ note }}')}
${blocks}
    </section>
${notes.map((t) => `  <p dir="ltr" style="margin: 0; font-size: 13px; line-height: 1.6; ${MUTED}">${esc(t)}</p>`).join('\n')}
    </div>`;
}

function openBody(spec: SheetSpec, o: OpenView, mounts: Mounts, h: number) {
  return `    <div${frame(spec)} style="height: ${String(h)}px; box-sizing: border-box; padding: 40px 48px; display: flex; flex-direction: column; gap: 24px; background: var(--shifa-color-bg-app);">
  <div dir="ltr" style="display: flex; flex-direction: column; gap: 4px;">
    <strong style="font-size: 20px; font-weight: 600;">${esc(spec.name)}</strong>
    <span style="font-size: 13px; ${MUTED}">${esc(o.cap)}</span>${spec.openOnly ? `\n    <span style="font-size: 13px; line-height: 1.6; max-width: 720px; ${MUTED}">${esc(spec.desc)}</span>` : ''}
  </div>
  <div style="display: flex; align-items: flex-start;">
    ${mounts.tag(spec.name, o.p)}
  </div>
    </div>`;
}

/** The whole board at height `h` (its tallest view). */
export function makeBoard(spec: SheetSpec, h: number): string {
  const mounts = new Mounts();
  const caps: Record<string, [string, string]> = {};
  const parts: string[] = [];
  if (!spec.openOnly) {
    parts.push(
      `  <sc-if value="{{ isSheet }}" hint-placeholder-val="{{ true }}">\n${sheetBody(spec, mounts, caps)}\n  </sc-if>`,
    );
  }
  (spec.open ?? []).forEach((o, i) => {
    const shown = spec.openOnly && i === 0 ? 'true' : 'false';
    parts.push(
      `  <sc-if value="{{ is${o.suffix} }}" hint-placeholder-val="{{ ${shown} }}">\n${openBody(spec, o, mounts, h)}\n  </sc-if>`,
    );
  });
  return page({
    title: spec.name,
    w: WIDTH,
    h,
    tweaks: boardTweaks(spec),
    logic: logic(spec, mounts.vals, caps),
    body: `<div data-theme="{{ theme }}" style="width: ${String(WIDTH)}px; height: ${String(h)}px; box-sizing: border-box; background: var(--shifa-color-bg-surface); color: var(--shifa-color-text-default); font-family: var(--font-sans);">
${parts.join('\n')}
</div>`,
  });
}
