#!/usr/bin/env node
// Runs dart or flutter from the pinned SDK. Usage: node scripts/dart.mjs <dart|flutter> [args...]
// Package scripts and verify call this instead of a global `dart`/`flutter`.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readPinnedVersion, resolveFlutterRoot, toolPath } from './lib/flutter-sdk.mjs';

const [tool, ...args] = process.argv.slice(2);
const root = join(import.meta.dirname, '..');

let bin;
try {
  const expected = readPinnedVersion(root);
  if (!expected) throw new Error('.fvmrc is missing or has no "flutter" version');
  bin = toolPath(resolveFlutterRoot({ root, expected }), /** @type {any} */ (tool));
} catch (err) {
  process.stderr.write(`dart.mjs: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}

const win = process.platform === 'win32';
// The SDK tools are .bat files on Windows and need a shell. Every argument is quoted (Windows
// paths cannot contain `"`), so `&`, `|`, `<`, `>` stay literal. Arguments come from package
// scripts, verify.mjs and the format hook (an edited file's path); `%VAR%` in a path would be
// expanded by cmd, which can only make formatting miss that file.
const quote = (s) => `"${String(s).replaceAll('"', '')}"`;
const result = win
  ? spawnSync([bin, ...args].map(quote).join(' '), { stdio: 'inherit', shell: true })
  : spawnSync(bin, args, { stdio: 'inherit' });
if (result.error) process.stderr.write(`dart.mjs: ${result.error.message}\n`);
process.exit(result.status ?? 1);
