#!/usr/bin/env node
// Fails when a hand-written .dart file is longer than the limit in lib/file-length.mjs.
// TypeScript and JavaScript are covered by ESLint `max-lines`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_LINES, tooLong } from './lib/file-length.mjs';

const root = join(import.meta.dirname, '..');
// Tracked and new (not ignored) files, so a long file fails before it is committed.
const paths = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.dart'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

// A tracked file deleted but not yet staged is still listed by --cached; skip it.
const files = [...new Set(paths)]
  .filter((path) => existsSync(join(root, path)))
  .map((path) => ({
    path,
    source: readFileSync(join(root, path), 'utf8'),
  }));
const failures = tooLong(files);
for (const f of failures) {
  process.stdout.write(`${f.path}: ${f.lines} lines (max ${MAX_LINES}); split the file\n`);
}
process.stdout.write(`file-length: ${files.length} Dart file(s) checked\n`);
process.exitCode = failures.length ? 1 : 0;
