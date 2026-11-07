#!/usr/bin/env node
// Usage: node scripts/check-pr-size.mjs <base-ref>
// Env: SIZE_OVERRIDE=true when the PR carries the owner's "size/override" label.
// Exits 1 above the hard limit; prints a GitHub annotation when running in Actions.

import { execFileSync } from 'node:child_process';
import { judge, measure } from './lib/pr-size.mjs';

const base = process.argv[2];
if (!base) {
  process.stderr.write('usage: check-pr-size.mjs <base-ref>\n');
  process.exit(2);
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const numstat = git(['diff', '--numstat', '--no-renames', `${base}...HEAD`]);
const paths = numstat
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t').slice(2).join('\t'));

const generated = new Set();
if (paths.length) {
  const attrs = execFileSync('git', ['check-attr', '--stdin', 'linguist-generated'], {
    input: paths.join('\n'),
    encoding: 'utf8',
  });
  for (const line of attrs.split('\n')) {
    const match = /^(.*): linguist-generated: (set|true)$/.exec(line);
    if (match?.[1]) generated.add(match[1]);
  }
}

const { counted, excluded } = measure(numstat, generated);
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
