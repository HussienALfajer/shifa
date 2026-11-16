// Which scripts/test suites run (scripts/run-script-tests.mjs). Full and docs modes, and CI, run
// every *.test.mjs file. Fast mode leaves out the suites that start Docker containers, unless a
// file they cover changed since main (committed, staged, unstaged or untracked): they took
// 8–14 s and bounded `verify fast` (OD-32).
//
// The list is explicit and checked by scripts/test/script-tests.test.mjs: every listed file must
// exist, and every suite whose source starts a container must be listed. Full mode never reads
// the list, so a listing mistake can only make fast mode slower or skip a suite there.
import { spawnSync } from 'node:child_process';

/**
 * Suites that start Docker containers, with the path prefixes whose change brings them back
 * into fast mode. Each also covers its own file and the paths in COMMON.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const DOCKER_SUITES = Object.freeze({
  'obs-collector-run.test.mjs': ['infra/observability/', 'scripts/test/fixtures/obs/'],
  'obs-collector-scrub.test.mjs': ['infra/observability/'],
  'obs-collector-validate.test.mjs': ['infra/observability/'],
});

/** Changes that bring every Docker suite back: the selection itself and the dependencies. */
const COMMON = ['scripts/run-script-tests.mjs', 'scripts/lib/script-tests.mjs', 'pnpm-lock.yaml'];

/**
 * @param {string[]} files test file names in scripts/test (no directory)
 * @param {{ fast: boolean, changed: string[] | null }} options `changed`: repository paths
 *   (forward slashes) changed since main; null when unknown, which runs every suite
 * @returns {{ run: string[], left: string[] }} suites to run, and Docker suites left out
 */
export function selectScriptTests(files, { fast, changed }) {
  if (!fast || changed === null) return { run: [...files], left: [] };
  const run = [];
  const left = [];
  for (const file of files) {
    const covers = DOCKER_SUITES[file];
    if (covers === undefined) {
      run.push(file);
      continue;
    }
    const prefixes = [...covers, ...COMMON, `scripts/test/${file}`];
    const touched = changed.some((path) => prefixes.some((prefix) => path.startsWith(prefix)));
    (touched ? run : left).push(file);
  }
  return { run, left };
}

/** True when a suite's source runs `docker run|create|start|compose` through spawn/exec. */
export function startsContainer(source) {
  return /['"]docker['"]\s*,\s*\[\s*['"](?:run|create|start|compose)['"]/.test(source);
}

/**
 * Paths changed since main: commits since the merge base, staged and unstaged changes, and
 * untracked files. Null when git cannot answer (no main branch, not a work tree), so the caller
 * runs every suite.
 * @param {string} root repository root
 * @returns {string[] | null}
 */
export function changedSinceMain(root) {
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null;
  };
  // The branch itself: a bare `main` would prefer a tag or refs/main of that name, and without
  // `--` a file named like the revision would be read as a path.
  const main = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', '--end-of-options', 'refs/heads/main^{commit}'],
    { cwd: root, encoding: 'utf8' },
  );
  if (main.status !== 0) return null;
  const lists = [
    git('diff', '--name-only', '--no-renames', '-z', `${main.stdout.trim()}...HEAD`, '--'),
    git('diff', '--name-only', '--no-renames', '-z', 'HEAD', '--'),
    git('ls-files', '--others', '--exclude-standard', '-z'),
  ];
  if (lists.some((list) => list === null)) return null;
  return [...new Set(lists.flat())];
}
