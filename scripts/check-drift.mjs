#!/usr/bin/env node
// Re-runs every registered generator (scripts/drift.config.mjs) into a temp directory and fails,
// naming each stale, missing or extra file, when the committed output differs.
// Usage: node scripts/check-drift.mjs [--full] [--fix] [--no-cache] [--list] [--root <dir>]
//                                     [--config <file>]
//   --full      also run checks marked `full` (verify full and CI)
//   --fix       regenerate fixable outputs in place (the only way to update generated files)
//   --no-cache  regenerate checks with `cacheInputs` even when their inputs and outputs are
//               unchanged since their last clean run (the cache is always off in CI; see
//               lib/drift-cache.mjs)
// Exit: 0 clean, 1 drift, 2 a generator crashed (log path printed).
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { formatReport, runDrift } from './lib/drift.mjs';
import { driftCacheDir } from './lib/drift-cache.mjs';

// A failure of the runner itself (bad flag, broken config) is a crash: exit 2, never 1 (drift).
process.on('uncaughtException', (err) => {
  process.stderr.write(`check-drift: ${err?.stack ?? err}\n`);
  process.exit(2);
});

const { values } = parseArgs({
  options: {
    full: { type: 'boolean', default: false },
    fix: { type: 'boolean', default: false },
    'no-cache': { type: 'boolean', default: false },
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
    const tags = [c.full && 'full', c.cacheInputs && 'cached'].filter(Boolean);
    process.stdout.write(
      `${c.name}${tags.length ? ` (${tags.join(', ')})` : ''}\n  inputs:  ${c.inputs.join(', ')}\n`,
    );
    if (c.cacheInputs) process.stdout.write(`  cache:   ${c.cacheInputs.join(', ')}\n`);
    process.stdout.write(`  outputs: ${c.outputs.join(', ')}\n`);
  }
  process.exit(0);
}

const logDir = process.env.DRIFT_LOG_DIR ?? join(root, '.verify', 'logs');
// With --root or --config the generator that runs need not be the one hashed under root, so a
// marker could vouch for code that never ran on that tree: the cache is off.
const cache =
  values.root || values.config
    ? { dir: null, reason: '--root/--config' }
    : driftCacheDir(root, { noCache: values['no-cache'] });
const { code, results } = await runDrift({
  root,
  checks,
  full: values.full,
  fix: values.fix,
  logDir,
  cacheDir: cache.dir ?? undefined,
});
const flags = [
  values.full ? 'full' : 'fast',
  values.fix && 'fix',
  cache.reason && `cache off: ${cache.reason}`,
];
process.stdout.write(`check-drift (${flags.filter(Boolean).join(', ')})\n`);
process.stdout.write(formatReport(results, { fix: values.fix }));
process.exitCode = code;
