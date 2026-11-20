// The Tailwind entry of packages/ui offers the token scales only (slice 0.4-03, backlog "Tailwind
// keeps its default spacing scale"): a spacing step that is not a token compiles to nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '@tailwindcss/node';
import { beforeAll, describe, expect, it } from 'vitest';

const entry = join(import.meta.dirname, '..', 'src', 'styles', 'tailwind.css');

let build: (candidates: string[]) => string;

beforeAll(async () => {
  const compiler = await compile(readFileSync(entry, 'utf8'), {
    base: join(import.meta.dirname, '..', 'src', 'styles'),
    onDependency: () => undefined,
  });
  build = (candidates) => compiler.build(candidates);
});

/** The declarations Tailwind wrote for `candidate`, or '' when it made no rule. */
function rule(candidate: string): string {
  const css = build([candidate]);
  const selector = `.${candidate.replaceAll('.', '\\.').replaceAll('/', '\\/')} {`;
  const at = css.indexOf(selector);
  if (at === -1) return '';
  return css.slice(at + selector.length, css.indexOf('}', at)).trim();
}

describe('Tailwind entry', () => {
  it('maps the spacing utilities to the space tokens', () => {
    expect(rule('p-4')).toBe('padding: var(--shifa-space-4);');
    expect(rule('ms-16')).toBe('margin-inline-start: var(--shifa-space-16);');
    expect(rule('gap-0')).toBe('gap: var(--shifa-space-0);');
  });

  it('names space.0-5 p-0.5, the usual Tailwind name', () => {
    expect(rule('p-0.5')).toBe('padding: var(--shifa-space-0-5);');
    expect(rule('p-0-5')).toBe('');
  });

  it('compiles a spacing step that is not a token to nothing', () => {
    for (const candidate of ['p-14', 'w-14', 'gap-2.5', 'mt-15', 'h-7.5', '-m-20']) {
      expect(rule(candidate), candidate).toBe('');
    }
  });

  it('keeps radius and colours on the tokens', () => {
    expect(rule('rounded-md')).toBe('border-radius: var(--shifa-radius-md);');
    expect(rule('bg-bg-surface')).toBe('background-color: var(--shifa-color-bg-surface);');
    expect(rule('bg-red-500')).toBe('');
  });

  it('carries the token custom properties and the font faces', () => {
    const css = build([]);
    expect(css).toContain('--shifa-space-4: 16px');
    expect(css).toContain("[data-theme='dark']");
    expect(css).toMatch(/@font-face\s*{[^}]*font-family: 'Shifa Sans Arabic'/);
    expect(css).not.toMatch(/Plex/);
  });
});
