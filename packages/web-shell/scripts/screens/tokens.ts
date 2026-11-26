// Every custom property the screens bundle reads must be declared somewhere in its stylesheet:
// an undeclared one (a token renamed or never defined) silently falls back to nothing, so a
// colour, a duration or a size quietly disappears from the boards. The check reads both the
// stylesheet and the script (inline styles name tokens too).

/** The custom properties declared (`--x:` or `@property --x`). */
export function declared(css: string): Set<string> {
  const names = new Set<string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) if (m[1]) names.add(m[1]);
  for (const m of css.matchAll(/@property\s+(--[\w-]+)/g)) if (m[1]) names.add(m[1]);
  return names;
}

/** The custom properties read (`var(--x)`, with or without a fallback). */
export function reads(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) if (m[1]) names.add(m[1]);
  return names;
}

/** The Shifa tokens read but never declared; Tailwind's own `--tw-*` are declared by Tailwind. */
export function undeclaredTokens(css: string, js: string): string[] {
  const have = declared(css);
  // A component may set one inline (`style={{ '--shifa-x': … }}`).
  for (const m of js.matchAll(/["'](--[\w-]+)["']\s*:/g)) if (m[1]) have.add(m[1]);
  const read = new Set([...reads(css), ...reads(js)]);
  return [...read].filter((name) => name.startsWith('--shifa-') && !have.has(name)).sort();
}
