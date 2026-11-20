// The custom variants of the Tailwind entry: dark by attribute, reduced motion by the system
// setting or by a data-motion="reduce" region (the ReducedMotion story state).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '@tailwindcss/node';
import { describe, expect, it } from 'vitest';

const styles = join(import.meta.dirname, '..', 'src', 'styles');

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(readFileSync(join(styles, 'tailwind.css'), 'utf8'), {
    base: styles,
    onDependency: () => undefined,
  });
  return compiler.build(candidates);
}

describe('custom variants', () => {
  it('motion-reduce: matches the system setting and a data-motion="reduce" region', async () => {
    const css = await build(['motion-reduce:animate-none']);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/\[data-motion="reduce"\]/);
  });

  it('dark: follows data-theme, not the system setting', async () => {
    const css = await build(['dark:bg-bg-surface']);
    expect(css).toMatch(/\[data-theme="dark"\]/);
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it('rtl: and in-data-[density=compact]: work for the components', async () => {
    const css = await build(['rtl:-scale-x-100', 'in-data-[density=compact]:px-2']);
    expect(css).toMatch(/dir="rtl"|:dir\(rtl\)/);
    expect(css).toMatch(/\[data-density="?compact"?\]/);
  });
});
