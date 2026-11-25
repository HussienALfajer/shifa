// Runs in the page (check.ts passes it to page.evaluate): renders an artboard as the canvas
// runtime does for the given tweak props — the logic class's `renderVals()`, `<sc-if>` branches,
// `{{ }}` holes in attributes and text, each x-import mounted as the bundle's component — then
// measures it. Self-contained: it is serialised into the page.

export interface BoardResult {
  missing: string[];
  over: string[];
  natural: number | null;
  content: number;
  frame: number;
}

export async function renderBoard({
  src,
  props,
  measureHeight,
}: {
  src: string;
  props: Record<string, unknown>;
  measureHeight: boolean;
}): Promise<BoardResult> {
  class DCLogic {
    props: Record<string, unknown> = props;
    state: Record<string, unknown> = {};
    // The playground panel's changes; a check renders the board as Tweaks set it.
    setState(): void {
      // Nothing to re-render here.
    }
  }
  (globalThis as unknown as { DCLogic: typeof DCLogic }).DCLogic = DCLogic;
  // biome-ignore lint/security/noGlobalEval: the artboard's own logic class, as the canvas runs it
  const Logic = (0, eval)(
    `(${src.replace('class Component extends DCLogic', 'class extends DCLogic')})`,
  ) as new () => {
    renderVals: () => Record<string, unknown>;
  };
  const vals = new Logic().renderVals();
  const missing: string[] = [];
  const HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const get = (path: string): unknown => {
    let at: unknown = vals;
    for (const part of path.split('.')) {
      if (at === null || typeof at !== 'object' || !(part in at)) {
        missing.push(path);
        return undefined;
      }
      at = (at as Record<string, unknown>)[part];
    }
    return at;
  };
  const whole = (value: string) => /^\{\{\s*([\w.$]+)\s*\}\}$/.exec(value)?.[1];
  const root = document.getElementById('root');
  if (!root) throw new Error('no #root');
  /** A hole's value as text: strings as they are, anything else as JSON, nothing as ''. */
  const asText = (value: unknown): string =>
    typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);
  root.append((document.getElementById('t') as HTMLTemplateElement).content.cloneNode(true));
  // Branches, innermost last: a removed branch takes its inner ones with it.
  for (const branch of [...root.querySelectorAll('sc-if')]) {
    if (!branch.isConnected) continue;
    const path = whole(branch.getAttribute('value') ?? '');
    if (path !== undefined && get(path)) branch.replaceWith(...branch.childNodes);
    else branch.remove();
  }
  // Holes in text and in the attributes of plain elements (x-import's are props, below).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeValue?.includes('{{'))
      n.nodeValue = n.nodeValue.replace(HOLE, (_, p: string) => asText(get(p)));
  }
  for (const el of root.querySelectorAll('*')) {
    if (el.tagName === 'X-IMPORT') continue;
    for (const a of [...el.attributes]) {
      if (a.value.includes('{{'))
        el.setAttribute(
          a.name,
          a.value.replace(HOLE, (_, p: string) => asText(get(p))),
        );
    }
  }
  const camel = (k: string) =>
    k.startsWith('aria-') || k.startsWith('data-')
      ? k
      : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const shifa = (
    globalThis as unknown as {
      Shifa: Record<string, unknown> & { mount: (e: Element, n: string, p: object) => void };
    }
  ).Shifa;
  for (const el of [...root.querySelectorAll('x-import')]) {
    const name = (el.getAttribute('component-from-global-scope') ?? '').replace('Shifa.', '');
    const mounted: Record<string, unknown> = {};
    for (const a of el.attributes) {
      if (a.name === 'component-from-global-scope' || a.name === 'style') continue;
      const path = whole(a.value);
      mounted[camel(a.name)] = path === undefined ? a.value : get(path);
    }
    // As the canvas runtime: text written inside an x-import never reaches the component.
    if (el.textContent.trim()) missing.push(`text inside ${name} (use the children attribute)`);
    const span = document.createElement('span');
    span.style.display = 'contents';
    el.replaceWith(span);
    if (!shifa[name]) missing.push(`component ${name}`);
    shifa.mount(span, name, mounted);
  }
  await new Promise((r) => setTimeout(r, 900));
  const frame = root.firstElementChild as HTMLElement;
  const top = frame.getBoundingClientRect().top;
  const over = new Set<string>();
  for (const el of frame.querySelectorAll('section, section *')) {
    if (el.closest('[popover]')) continue;
    const section = el.closest('section');
    if (!section) continue;
    const panel = section.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > panel.right + 0.5 || r.left < panel.left - 0.5)) {
      over.add(`${el.tagName} «${el.textContent.trim().slice(0, 24)}»`);
    }
  }
  let natural: number | null = null;
  if (measureHeight) {
    const keep = frame.style.height;
    frame.style.height = 'auto';
    natural = Math.ceil(frame.getBoundingClientRect().height);
    frame.style.height = keep;
  }
  const content =
    Math.max(
      ...[...frame.querySelectorAll(':scope > *')].map((e) => e.getBoundingClientRect().bottom),
      top,
    ) - top;
  return {
    missing: [...new Set(missing)],
    over: [...over].slice(0, 6),
    natural,
    content: Math.round(content),
    frame: frame.getBoundingClientRect().height,
  };
}
