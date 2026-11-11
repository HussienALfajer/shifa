// Stricter scan added after review: forms the line patterns in purity.test.ts do not catch.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_DIR = join(import.meta.dirname, '..', '..', 'src', 'synthetic');

const listSources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ['Date() call (current time)', /(?<!new\s)\bDate\s*\(/],
  ['new Date without arguments', /new\s+Date\b(?!\s*\(\s*[^)\s])/],
  ['process', /\bprocess\b/],
  ['require or dynamic import', /\b(require|import)\s*\(/],
  ['timers', /\b(setTimeout|setInterval|setImmediate|queueMicrotask)\b/],
  ['Intl (locale-dependent)', /\bIntl\b/],
  ['toLocale* (locale-dependent)', /\.toLocale\w*\(/],
];

describe('stricter source scan of src/synthetic', () => {
  it('finds no ambient time, environment, loading, timers or locale use', () => {
    const files = listSources(SOURCE_DIR);
    expect(files.length).toBeGreaterThanOrEqual(6);
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const [label, pattern] of FORBIDDEN) {
            if (pattern.test(line)) {
              hits.push(`${relative(SOURCE_DIR, file)}:${String(index + 1)} ${label}`);
            }
          }
        });
    }
    expect(hits).toEqual([]);
  });

  it('catches the forms it is meant to catch', () => {
    const caught = (line: string): boolean => FORBIDDEN.some(([, pattern]) => pattern.test(line));
    expect(caught('const now = Date();')).toBe(true);
    expect(caught('const now = new Date;')).toBe(true);
    expect(caught('const now = new Date( );')).toBe(true);
    expect(caught("const env = process['env'];")).toBe(true);
    expect(caught("const m = await import('x');")).toBe(true);
    expect(caught('const fixed = new Date(epochMs);')).toBe(false);
  });
});
