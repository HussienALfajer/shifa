// cn() is told the token theme's names; this keeps that list equal to the generated theme.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cn } from '../src/index.ts';
import { THEME_NAMES, type ThemeNamespace } from '../src/lib/theme-names.ts';

const theme = readFileSync(
  join(import.meta.dirname, '..', '..', 'tokens', 'generated', 'css', 'tailwind-theme.css'),
  'utf8',
);

/** The names the generated theme defines in `namespace` (`--text-body` → `body`). */
function generated(namespace: ThemeNamespace): string[] {
  const names = [
    ...theme.matchAll(new RegExp(`^\\s*--${namespace}-([\\w-]+):\\s*var\\(`, 'gm')),
  ].map((m) => (m[1] ?? '').replaceAll('_', '.'));
  // `--font-weight-*` would otherwise also match the `font` namespace.
  return namespace === 'font' ? names.filter((n) => !n.startsWith('weight-')) : names;
}

describe('THEME_NAMES', () => {
  it.each(Object.keys(THEME_NAMES) as ThemeNamespace[])('%s equals the generated theme', (ns) => {
    expect([...THEME_NAMES[ns]].sort()).toEqual(generated(ns).sort());
  });
});

describe('cn', () => {
  it('keeps a size and a colour of the text namespace', () => {
    expect(cn('text-body', 'text-text-muted')).toBe('text-body text-text-muted');
  });

  it('lets the later class of the same kind win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-body', 'text-caption')).toBe('text-caption');
    expect(cn('bg-bg-surface', 'bg-brand-primary')).toBe('bg-brand-primary');
    expect(cn('rounded-md', 'rounded-control')).toBe('rounded-control');
    expect(cn('shadow-card', 'shadow-focus')).toBe('shadow-focus');
  });

  it('drops falsy parts', () => {
    expect(cn('ps-2', false, undefined, null, { 'pe-2': true, 'pe-4': false })).toBe('ps-2 pe-2');
  });
});
