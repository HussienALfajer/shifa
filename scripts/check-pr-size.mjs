#!/usr/bin/env node
// Usage: node scripts/check-pr-size.mjs <base-ref>
// Env: SIZE_OVERRIDE=true when the PR carries the owner's "size/override" label.
// Exits 1 above the hard limit; prints a GitHub annotation when running in Actions.

import { execFileSync } from 'node:child_process';
import { judge, measure, parseNumstatZ } from './lib/pr-size.mjs';

const base = process.argv[2];
if (!base) {
  process.stderr.write('usage: check-pr-size.mjs <base-ref>\n');
  process.exit(2);
}

const git = (args, input) =>
  execFileSync('git', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });

// -z keeps unusual paths unquoted; -M counts a moved file once, as its edits only.
const entries = parseNumstatZ(git(['diff', '-z', '--numstat', '-M', `${base}...HEAD`]));

// Attributes come from the base branch, so a PR cannot exempt its own files by editing
// .gitattributes.
const generated = new Set();
if (entries.length) {
  const out = git(
    ['check-attr', '-z', '--stdin', `--source=${base}`, 'linguist-generated'],
    entries.map((e) => e.path).join('\0'),
  ).split('\0');
  for (let i = 0; i + 2 < out.length; i += 3) {
    const [path, , value] = [out[i], out[i + 1], out[i + 2]];
    if (path && (value === 'set' || value === 'true')) generated.add(path);
  }
}

const { counted, excluded } = measure(entries, generated);
const verdict = judge(counted, process.env.SIZE_OVERRIDE === 'true');
const inActions = process.env.GITHUB_ACTIONS === 'true';
const prefix = {
  ok: '',
  warn: inActions ? '::warning::' : 'warning: ',
  fail: inActions ? '::error::' : 'error: ',
}[verdict.level];
process.stdout.write(
  `${prefix}${verdict.message} (${excluded} generated/binary file(s) excluded)\n`,
);
process.exitCode = verdict.level === 'fail' ? 1 : 0;
