// The artboards of the "Shifa Components" canvas (ADR-0048): one sheet per component, the real
// component mounted from the system's bundle (`<x-import component-from-global-scope="Shifa.X">`)
// in four panels (light and dark, comfortable and compact), the open views of the overlays, and the
// index board. Non-text props travel through the logic class (`{{ v.pN }}`).
import type { Block, Density, Item, OpenView, Props, SheetSpec, Theme } from './types.ts';

export const WIDTH = 1440;
export const GROUPS = [
  'Foundations',
  'Actions',
  'Forms',
  'Navigation',
  'Overlays',
  'Data display',
  'Feedback',
];

export const esc = (s: unknown) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const kebab = (k: string) =>
  k.startsWith('aria-') || k.startsWith('data-')
    ? k
    : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const MUTED = 'color: var(--shifa-color-text-muted);';
const PANELS: { theme: Theme; density: Density; title: string; note: string }[] = [
  {
    theme: 'light',
    density: 'comfortable',
    title: 'Light · comfortable',
    note: 'touch and pointer · 44 px controls, 48 px rows',
  },
  {
    theme: 'dark',
    density: 'comfortable',
    title: 'Dark · comfortable',
    note: 'touch and pointer · 44 px controls, 48 px rows',
  },
  {
    theme: 'light',
    density: 'compact',
    title: 'Light · compact',
    note: 'pointer devices only · 32 px controls and rows',
  },
  {
    theme: 'dark',
    density: 'compact',
    title: 'Dark · compact',
    note: 'pointer devices only · 32 px controls and rows',
  },
];
const PSEUDO = { hover: 'hover', pressed: 'hover active', focus: 'focus' } as const;

/** Props as attributes: strings inline, anything else through the logic class's values. */
class Mounts {
  readonly vals: Record<string, unknown> = {};
  #n = 0;

  tag(component: string, props: Props, withChildren = true): string {
    const attrs: string[] = [];
    let children = '';
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) continue;
      if (withChildren && k === 'children' && typeof v === 'string') {
        children = esc(v);
      } else if (typeof v === 'string') {
        attrs.push(`${kebab(k)}="${esc(v)}"`);
      } else {
        this.#n += 1;
        const key = `p${String(this.#n)}`;
        this.vals[key] = v;
        attrs.push(`${kebab(k)}="{{ v.${key} }}"`);
      }
    }
    const list = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    return `<x-import component-from-global-scope="Shifa.${component}"${list}>${children}</x-import>`;
  }
}

interface PageInput {
  title: string;
  w: number;
  h: number;
  vals: Record<string, unknown>;
  body: string;
}

export function page({ title, w, h, vals, body }: PageInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/shifa/tokens.css">
<link rel="stylesheet" href="ds/shifa/components/bundle.css">
<link rel="stylesheet" href="support/states.css">
<script src="ds/shifa/components/bundle.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
*,*::before,*::after{box-sizing:border-box}
a{color:var(--shifa-color-brand-primary)}a:hover{color:var(--shifa-color-brand-primary-hover)}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${String(w)},"height":${String(h)}}}'>
class Component extends DCLogic {
  renderVals() {
    return { v: ${JSON.stringify(vals)} };
  }
}
</script>
</body>
</html>
`;
}

export function makeSheet(spec: SheetSpec, h: number): string {
  const mounts = new Mounts();
  let usesPseudo = false;
  const item = (it: Item, ind: string) => {
    let slot = mounts.tag(it.c ?? spec.name, it.p);
    if (it.pseudo) {
      usesPseudo = true;
      slot = `<div data-pseudo="${PSEUDO[it.pseudo]}" style="display: block; min-width: 0;">${slot}</div>`;
    }
    const width = it.w ? `width: ${String(it.w)}px; max-width: 100%;` : 'min-width: 0;';
    const dir = it.dir ? ` dir="${it.dir}"` : '';
    const cap = it.cap
      ? `\n${ind}  <span style="font-size: 12px; line-height: 1.4; ${MUTED}" dir="ltr">${esc(it.cap)}</span>`
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
  const panels = spec.density === false ? PANELS.slice(0, 2) : PANELS;
  const panelHtml = panels
    .map((pn) => {
      const dens = pn.density === 'compact' ? ' data-density="compact"' : '';
      const blocks = spec
        .blocks(pn.density)
        .map((b) => block(b, '      '))
        .join('\n');
      const note = spec.density === false ? 'the same in both densities' : pn.note;
      return `    <section data-theme="${pn.theme}"${dens} dir="rtl" lang="ar" style="display: flex; flex-direction: column; gap: 24px; min-width: 0; padding: 24px; border-radius: 16px; background: var(--shifa-color-bg-app); color: var(--shifa-color-text-default); border: 1px solid var(--shifa-color-border-default);">
      <div dir="ltr" style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--shifa-color-border-default);">
        <strong style="font-size: 16px; font-weight: 600;">${pn.title}</strong>
        <span style="font-size: 12px; ${MUTED}">${note}</span>
      </div>
${blocks}
    </section>`;
    })
    .join('\n');
  const cols = spec.layout === 'stack' ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))';
  const notes: string[] = [];
  if (usesPseudo) {
    notes.push(
      'Hover, pressed and keyboard focus copies are fixed for display: the component’s own :hover, :active and :focus-visible rules, switched on by the frame around it. Every other copy is live.',
    );
  }
  if (spec.density === false)
    notes.push('This component has no compact values, so the compact density draws it the same.');
  if (spec.open) {
    const many = spec.open.length > 1;
    notes.push(
      `The open ${many ? 'views are' : 'view is'} on the board${many ? 's' : ''} beside this one: a modal covers its whole frame.`,
    );
  }
  return page({
    title: spec.name,
    w: WIDTH,
    h,
    vals: mounts.vals,
    body: `<div data-theme="light" style="width: ${String(WIDTH)}px; height: ${String(h)}px; box-sizing: border-box; padding: 56px 64px; display: flex; flex-direction: column; gap: 28px; background: var(--shifa-color-bg-surface); color: var(--shifa-color-text-default); font-family: var(--font-sans);">
  <div style="display: flex; justify-content: space-between; gap: 48px; align-items: flex-end;">
    <div style="display: flex; flex-direction: column; gap: 8px; max-width: 820px;">
      <p style="margin: 0; font-size: 14px; font-weight: 500; ${MUTED}">${esc(spec.group.toUpperCase())} · COMPONENT</p>
      <h1 style="margin: 0; font-size: 31px; line-height: 1.3; font-weight: 600;">${esc(spec.name)}</h1>
      <p style="margin: 0; font-size: 16px; line-height: 1.6; ${MUTED}">${esc(spec.desc)}</p>
    </div>
    <div style="flex: none; width: 360px; display: flex; flex-direction: column; gap: 6px; padding: 16px 20px; border-radius: 12px; background: var(--shifa-color-bg-app); border: 1px solid var(--shifa-color-border-default);">
      <span style="font-size: 13px; font-weight: 600;">The real component</span>
      <code style="font-size: 13px; font-family: var(--font-mono);">Shifa.${esc(spec.name)}</code>
      <span style="font-size: 13px; line-height: 1.5; ${MUTED}">In Play: ${esc(spec.play)}</span>
    </div>
  </div>
  <div style="display: grid; grid-template-columns: ${cols}; gap: 24px; align-items: start;">
${panelHtml}
  </div>
${notes.map((t) => `  <p style="margin: 0; font-size: 13px; line-height: 1.6; ${MUTED}">${esc(t)}</p>`).join('\n')}
</div>`,
  });
}

export function makeOpen(spec: SheetSpec, o: OpenView): string {
  const mounts = new Mounts();
  const tag = mounts.tag(spec.name, o.p, false);
  const dens = o.density === 'compact' ? ' data-density="compact"' : '';
  const toastNote =
    spec.openOnly && o.suffix === ''
      ? `\n    <span style="font-size: 13px; line-height: 1.6; max-width: 720px; ${MUTED}">${esc(spec.desc)} One board per theme and density: a toast sits in the frame’s own corner, so two cards on one board would overlap.</span>`
      : '';
  return page({
    title: `${spec.name} · ${o.cap}`,
    w: o.w,
    h: o.h,
    vals: mounts.vals,
    body: `<div data-theme="${o.theme}"${dens} dir="rtl" lang="ar" style="width: ${String(o.w)}px; height: ${String(o.h)}px; box-sizing: border-box; padding: 40px 48px; display: flex; flex-direction: column; gap: 24px; background: var(--shifa-color-bg-app); color: var(--shifa-color-text-default); font-family: var(--font-sans);">
  <div dir="ltr" style="display: flex; flex-direction: column; gap: 4px;">
    <strong style="font-size: 20px; font-weight: 600;">${esc(spec.name)}</strong>
    <span style="font-size: 13px; ${MUTED}">${esc(o.cap)}</span>${toastNote}
  </div>
  <div style="display: flex; align-items: flex-start;">
    ${tag}
  </div>
</div>`,
  });
}
