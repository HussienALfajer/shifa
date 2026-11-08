#!/usr/bin/env node
// Re-runs every registered generator (scripts/drift.config.mjs) into a temp directory and fails,
// naming each stale, missing or extra file, when the committed output differs.
// Usage: node scripts/check-drift.mjs [--full] [--fix] [--list] [--root <dir>] [--config <file>]
//   --full  also run checks marked `full` (verify full and CI)
//   --fix   regenerate fixable outputs in place (the only way to update generated files)
// Exit: 0 clean, 1 drift, 2 a generator crashed (log path printed).
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { formatReport, runDrift } from './lib/drift.mjs';

// A failure of the runner itself (bad flag, broken config) is a crash: exit 2, never 1 (drift).
process.on('uncaughtException', (err) => {
  process.stderr.write(`check-drift: ${err?.stack ?? err}\n`);
  process.exit(2);
});

const { values } = parseArgs({
  options: {
    full: { type: 'boolean', default: false },
    fix: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
    root: { type: 'string' },
    config: { type: 'string' },
  },
});

const root = resolve(values.root ?? join(import.meta.dirname, '..'));
const config = resolve(values.config ?? join(import.meta.dirname, 'drift.config.mjs'));
const { default: checks } = await import(pathToFileURL(config).href);

if (values.list) {
  for (const c of checks) {
    process.stdout.write(
      `${c.name}${c.full ? ' (full)' : ''}\n  inputs:  ${c.inputs.join(', ')}\n`,
    );
    process.stdout.write(`  outputs: ${c.outputs.join(', ')}\n`);
  }
  process.exit(0);
}

const logDir = process.env.DRIFT_LOG_DIR ?? join(root, '.verify', 'logs');
const { code, results } = await runDrift({
  root,
  checks,
  full: values.full,
  fix: values.fix,
  logDir,
});
process.stdout.write(
  `check-drift (${values.full ? 'full' : 'fast'}${values.fix ? ', fix' : ''})\n`,
);
process.stdout.write(formatReport(results, { fix: values.fix }));
process.exitCode = code;
