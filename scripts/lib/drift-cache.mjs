// Drift cache: lets a slow drift check (one with `cacheInputs`, lib/drift.mjs) skip its
// generator when nothing it depends on changed since its last CLEAN run. The key is a sha256 over
// the runner's own source, the check's name, mode and size budget, and the path and raw bytes of
// every file under the check's `inputs`, `cacheInputs` (generator source, pinned toolchain) and
// committed `outputs`. Any edit on either side, an added or removed file, is a miss. --fix always
// regenerates, and only a clean run of an unchanged tree is recorded.
//
// Trust: a marker is a bare claim "this exact tree was clean"; nothing can check it without
// running the generator. So markers are read only where this machine wrote them (.verify/ is
// git-ignored), never in CI and never when the branch tracks files under .verify/. A marker that
// came from elsewhere (a CI cache entry planted by code running on main, or a file committed to
// the branch) would let a pull request with a hand-edited "generated" client pass the check for
// the exact tree its author hashed. CI always regenerates.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = 'drift-cache v1';
const RUNNER_SOURCES = ['drift.mjs', 'drift-cache.mjs'].map((f) => join(import.meta.dirname, f));

/**
 * Feeds every file at each repo-relative path: sorted, path- and length-prefixed raw bytes.
 * @param {import('node:crypto').Hash} hash
 * @param {(base: string, rel: string) => string[]} listFiles lib/drift.mjs's walker, so the key
 *   covers exactly the files the comparison reads
 */
function hashPaths(hash, root, label, paths, listFiles) {
  for (const rel of [...new Set(paths)].sort()) {
    hash.update(`\0${label}:${rel}\0`);
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      hash.update('\0missing\0');
      continue;
    }
    hash.update(statSync(abs).isDirectory() ? '\0dir\0' : '\0file\0');
    for (const path of listFiles(root, rel)) {
      const bytes = readFileSync(join(root, path));
      hash.update(`\0${path}\0${bytes.length}\0`);
      hash.update(bytes);
    }
  }
}

/**
 * The cache key of `check` for the tree at `root`; throws when a file cannot be read.
 * @param {string} root
 * @param {{ name: string, inputs: string[], cacheInputs: string[], outputs: string[],
 *   full?: boolean, budget?: object }} check
 * @param {(base: string, rel: string) => string[]} listFiles
 */
export function cacheKey(root, check, listFiles) {
  const hash = createHash('sha256').update(`${VERSION}\0${check.name}\0`);
  for (const source of RUNNER_SOURCES) hash.update(readFileSync(source)).update('\0');
  hash.update(JSON.stringify({ budget: check.budget ?? null, full: Boolean(check.full) }));
  hashPaths(hash, root, 'input', [...check.inputs, ...check.cacheInputs], listFiles);
  hashPaths(hash, root, 'output', check.outputs, listFiles);
  return hash.digest('hex');
}

const markerPath = (dir, name) => join(dir, `${name}.sha256`);

/** The key recorded after the last clean run of `name`, or null. */
export function readMarker(dir, name) {
  try {
    return readFileSync(markerPath(dir, name), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

export function writeMarker(dir, name, key) {
  mkdirSync(dir, { recursive: true });
  const tmp = `${markerPath(dir, name)}.${process.pid}.tmp`;
  writeFileSync(tmp, `${key}\n`);
  renameSync(tmp, markerPath(dir, name));
}

const isSet = (value) => Boolean(value) && value !== '0' && value.toLowerCase() !== 'false';

/**
 * Where markers live for `root`, or `{ dir: null, reason }` when they must not be used: with
 * --no-cache, in CI (`CI` or `GITHUB_ACTIONS` set), when git tracks anything under .verify/ (a
 * marker committed to the branch) and when git cannot answer (not a work tree).
 * @param {string} root
 * @param {{ env?: NodeJS.ProcessEnv, noCache?: boolean }} [options]
 * @returns {{ dir: string | null, reason?: string }}
 */
export function driftCacheDir(root, { env = process.env, noCache = false } = {}) {
  if (noCache) return { dir: null, reason: '--no-cache' };
  if (isSet(env.CI) || isSet(env.GITHUB_ACTIONS)) return { dir: null, reason: 'CI' };
  const tracked = spawnSync('git', ['ls-files', '-z', '--', '.verify'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (tracked.status !== 0) return { dir: null, reason: 'not a git work tree' };
  if (tracked.stdout) return { dir: null, reason: 'git tracks files under .verify/' };
  return { dir: join(root, '.verify', 'drift-cache') };
}
