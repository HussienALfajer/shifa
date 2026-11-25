// The artboard shell of the "Shifa Components" canvas (ADR-0048): the head that loads the
// system's tokens, bundle and forced-states sheet, the logic class, the Tweaks it declares, and
// the mounting of real components (`<x-import component-from-global-scope="Shifa.X">`). Non-text
// props travel through the logic class (`{{ v.pN }}`); Tweaks reach props through `{{ pg.cN }}`.
import type { Props } from './types.ts';

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
export const kebab = (k: string) =>
  k.startsWith('aria-') || k.startsWith('data-')
    ? k
    : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Props as attributes: strings inline, anything else through the logic class's values. */
export class Mounts {
  readonly vals: Record<string, unknown> = {};
  #n = 0;

  /**
   * `holes` maps a prop to a value path of `renderVals()` (a tweak). A string child goes in as
   * the `children` attribute: the canvas runtime passes an x-import its attributes only, never
   * the text written inside it (checked with the runtime itself: a Button's label was dropped).
   */
  tag(component: string, props: Props, holes: Record<string, string> = {}): string {
    const attrs: string[] = [];
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || k in holes) continue;
      if (typeof v === 'string') {
        attrs.push(`${kebab(k)}="${esc(v)}"`);
      } else {
        this.#n += 1;
        const key = `p${String(this.#n)}`;
        this.vals[key] = v;
        attrs.push(`${kebab(k)}="{{ v.${key} }}"`);
      }
    }
    for (const [k, path] of Object.entries(holes)) attrs.push(`${kebab(k)}="{{ ${path} }}"`);
    const list = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    return `<x-import component-from-global-scope="Shifa.${component}"${list}></x-import>`;
  }
}

/** One tweak of the board (`data-props` entry). */
export interface TweakDef {
  editor: 'text' | 'boolean' | 'enum' | 'int';
  default: unknown;
  options?: unknown[];
  section: string;
}

interface PageInput {
  title: string;
  w: number;
  h: number;
  tweaks?: Record<string, TweakDef>;
  /** The body of `renderVals()`: plain JS returning the template's values. */
  logic: string;
  body: string;
}

/** `data-props` is an HTML attribute in single quotes: & and ' are escaped (format.md). */
const propsAttr = (value: unknown) =>
  JSON.stringify(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;');

export function page({ title, w, h, tweaks = {}, logic, body }: PageInput): string {
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
<script type="text/x-dc" data-dc-script data-props='${propsAttr({ ...tweaks, $preview: { width: w, height: h } })}'>
class Component extends DCLogic {
  renderVals() {
${logic}
  }
}
</script>
</body>
</html>
`;
}
