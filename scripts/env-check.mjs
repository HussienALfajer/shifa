#!/usr/bin/env node
// `pnpm env:check`: is this machine ready to build Shifa? Prints one line per item (ok, warn,
// fail) and exits 1 on any fail. Setup and fixes: docs/process/wsl2-setup.md.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { formatRows, runEnvChecks } from './lib/env-check.mjs';
import { readPinnedVersion, readSdkVersion, resolveFlutterRoot } from './lib/flutter-sdk.mjs';

const root = join(import.meta.dirname, '..');
const win = process.platform === 'win32';

/**
 * Runs a tool and returns its trimmed stdout, or null when it is missing or fails.
 * @param {string} cmd @param {string[]} args @param {number} [timeout]
 */
function capture(cmd, args, timeout = 20_000) {
  // On Windows, pnpm is a .cmd shim that needs a shell (as in scripts/verify.mjs). Arguments
  // here are fixed strings from this file, so joining them into one command line is safe.
  const shell = win && cmd === 'pnpm';
  const result = spawnSync(shell ? [cmd, ...args].join(' ') : cmd, shell ? [] : args, {
    cwd: root,
    encoding: 'utf8',
    shell,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim() || null;
}

/** @type {import('./lib/env-check.mjs').Probes} */
const probes = {
  nodeVersion: () => process.version,
  pnpmVersion: () => capture('pnpm', ['--version']),
  packageManager: () => JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).packageManager,
  pinnedFlutter: () => readPinnedVersion(root),
  fvmFlutterVersion: () => {
    try {
      return readSdkVersion(resolveFlutterRoot({ root }));
    } catch {
      return null;
    }
  },
  dockerReachable: () => capture('docker', ['info', '--format', '{{.ServerVersion}}'], 15_000),
  gitConfig: (key) => capture('git', ['config', '--get', key]),
  lsFilesEol: () => capture('git', ['ls-files', '--eol']) ?? '',
  which: (cmd) =>
    (process.env.PATH ?? '').split(delimiter).some((dir) => dir && existsSync(join(dir, cmd))),
};

const { rows, exitCode } = runEnvChecks(probes, { platform: process.platform, repoRoot: root });
process.stdout.write(formatRows(rows));
process.exitCode = exitCode;
