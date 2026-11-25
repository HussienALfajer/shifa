// The token values the component stylesheet needs and the system's tokens.css does not carry.
// tokens.json holds the families the Design System format knows (colour, type styles, spacing,
// radius, shadow, size, z-index); the components also read motion, the raw type scale and the
// semantic text tokens. Without them a canvas resolved `var(--shifa-motion-easing-exit)` to
// nothing, which drops the whole `animation` (a still Spinner) and every text size or weight
// that names one. bundle.ts appends their values from the code's own token output.

const DECLARATION = /(--shifa-[\w-]+)\s*:\s*([^;}]+)/g;
const USE = /var\(\s*(--shifa-[\w-]+)/g;

/** The custom properties a stylesheet declares. */
export function declared(css: string): Set<string> {
  return new Set([...css.matchAll(DECLARATION)].map((m) => m[1] ?? ''));
}

/** The custom properties a stylesheet reads with var(). */
export function used(css: string): Set<string> {
  return new Set([...css.matchAll(USE)].map((m) => m[1] ?? ''));
}

/** `--shifa-*` names `css` reads that none of `sheets` (it included) declares, sorted. */
export function undefinedTokens(css: string, ...sheets: string[]): string[] {
  const known = new Set([...declared(css), ...sheets.flatMap((s) => [...declared(s)])]);
  return [...used(css)].filter((name) => !known.has(name)).sort();
}

/** The first `:root {…}` block of the code's token output: the theme-free values. */
function rootValues(codeCss: string): Map<string, string> {
  const start = codeCss.indexOf(':root {');
  if (start === -1) throw new Error('token gaps: no :root block in the code token output');
  const block = codeCss.slice(start, codeCss.indexOf('}', start));
  return new Map([...block.matchAll(DECLARATION)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

/**
 * A `:root` block declaring every token `bundleCss` reads that `systemCss` lacks, with the values
 * of `codeCss` (and, in turn, the tokens those values read). Throws on a token the code lacks too.
 */
export function gapBlock(bundleCss: string, systemCss: string, codeCss: string): string {
  const values = rootValues(codeCss);
  const known = new Set([...declared(systemCss), ...declared(bundleCss)]);
  const out = new Map<string, string>();
  const queue = [...used(bundleCss)].filter((name) => !known.has(name));
  while (queue.length > 0) {
    const name = queue.shift() ?? '';
    if (out.has(name) || known.has(name)) continue;
    const value = values.get(name);
    if (value === undefined) throw new Error(`token gaps: ${name} is not a code token`);
    out.set(name, value);
    queue.push(...used(value));
  }
  if (out.size === 0) return '';
  const lines = [...out].sort(([a], [b]) => a.localeCompare(b));
  return `/* Tokens the components read that tokens.json does not carry (motion, type scale, text). */\n:root {\n${lines.map(([n, v]) => `  ${n}: ${v};`).join('\n')}\n}\n`;
}
