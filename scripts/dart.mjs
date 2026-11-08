#!/usr/bin/env node
// Runs dart or flutter from the pinned SDK. Usage: node scripts/dart.mjs <dart|flutter> [args...]
// Package scripts and verify call this instead of a global `dart`/`flutter`.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { resolveFlutterRoot, toolPath } from './lib/flutter-sdk.mjs';

const [tool, ...args] = process.argv.slice(2);
const root = join(import.meta.dirname, '..');

let bin;
try {
  bin = toolPath(resolveFlutterRoot({ root }), /** @type {any} */ (tool));
} catch (err) {
  process.stderr.write(`dart.mjs: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}

const win = process.platform === 'win32';
// The SDK tools are .bat files on Windows and need a shell. Quote every argument; the arguments
// come from package scripts and verify.mjs, never from user input.
const quote = (s) => `"${String(s).replaceAll('"', '')}"`;
const result = win
  ? spawnSync([bin, ...args].map(quote).join(' '), { stdio: 'inherit', shell: true })
  : spawnSync(bin, args, { stdio: 'inherit' });
if (result.error) process.stderr.write(`dart.mjs: ${result.error.message}\n`);
process.exit(result.status ?? 1);
