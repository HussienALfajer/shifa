// tokens.css of the Shifa Design System, compiled from its tokens.json (the Design System type's
// list format, packages/tokens/scripts/design-system.ts) the way that type compiles it: colours
// and shadows per theme (an alias is declared again in each further theme, so it follows the
// token it points at there), the other scales on :root, one class per type style, @font-face.

type Value = string | Record<string, string>;
interface Token {
  name: string;
  value: Value;
}
interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: number | string;
  fontWeight: number | string;
  family?: string;
}
export interface DsTokens {
  name: string;
  color: { themes: { id: string }[]; tokens: Token[] };
  shadow?: { tokens: Token[] };
  type: {
    fonts: { family: string; file: string; weight: string; style: string }[];
    families: Record<string, string>;
    groups: { family: string; styles: TypeStyle[] }[];
  };
  [family: string]: unknown;
}

/** Families that are not plain `{ tokens }` lists of one value. */
const SPECIAL = new Set(['name', 'version', 'meta', 'color', 'shadow', 'type']);

const css = (value: string) => {
  const alias = /^\{([\w.-]+)\}$/.exec(value);
  return alias ? `var(--${alias[1] ?? ''})` : value;
};
const inTheme = (token: Token, theme: string, first: string) =>
  typeof token.value === 'string' ? token.value : (token.value[theme] ?? token.value[first] ?? '');
const isAlias = (value: string) => /^\{[\w.-]+\}$/.test(value);
const FORMAT: Record<string, string> = {
  ttf: 'truetype',
  otf: 'opentype',
  woff: 'woff',
  woff2: 'woff2',
};

/** The stylesheet; `title` is the system's name (its index title), line 1 of the file. */
export function compileTokensCss(tokens: DsTokens, title: string): string {
  const themes = tokens.color.themes.map((t) => t.id);
  const first = themes[0] ?? 'light';
  const themed = [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])];
  const lines = [`/* ${title} — generated from tokens.json */`];

  lines.push(`:root, [data-theme="${first}"] {`);
  for (const t of themed) lines.push(`  --${t.name}: ${css(inTheme(t, first, first))};`);
  lines.push('}');
  for (const theme of themes.slice(1)) {
    lines.push(`[data-theme="${theme}"] {`);
    for (const t of themed) {
      const value = inTheme(t, theme, first);
      if (value !== inTheme(t, first, first) || isAlias(value)) {
        lines.push(`  --${t.name}: ${css(value)};`);
      }
    }
    lines.push('}');
  }

  lines.push(':root {');
  for (const [family, group] of Object.entries(tokens)) {
    if (SPECIAL.has(family)) continue;
    for (const t of (group as { tokens?: Token[] }).tokens ?? []) {
      lines.push(`  --${t.name}: ${css(inTheme(t, first, first))};`);
    }
  }
  for (const [key, stack] of Object.entries(tokens.type.families)) {
    lines.push(`  --font-${key}: ${stack};`);
  }
  lines.push('}');

  for (const group of tokens.type.groups) {
    for (const s of group.styles) {
      lines.push(
        `.${s.name} { font-family: var(--font-${s.family ?? group.family}); font-size: ${s.fontSize}; line-height: ${String(s.lineHeight)}; font-weight: ${String(s.fontWeight)}; }`,
      );
    }
  }
  for (const f of tokens.type.fonts) {
    const format = FORMAT[f.file.slice(f.file.lastIndexOf('.') + 1)] ?? 'truetype';
    lines.push(
      `@font-face { font-family: '${f.family}'; src: url('${f.file}') format('${format}'); font-weight: ${f.weight}; font-style: ${f.style}; font-display: swap; }`,
    );
  }
  return `${lines.join('\n')}\n`;
}
