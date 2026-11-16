// The steps of scripts/verify.mjs and the scheduler that runs them, kept apart from the CLI so
// scripts/test can check the graph and the ordering rules.
//
// Steps start together unless one names another:
//   requires — waits for that step and is skipped (counted as failed) when it failed;
//   after    — waits for those steps whatever their result (they share files or tools).
// A dependency that the mode filtered out counts as done. Results keep the declared order, so
// the summary reads as it did when the steps ran one after another.
//
// What runs together, and why the rest waits:
//   - format, instructions, lint-root, scripts-test and file-length only read the tree (their
//     own state lives under .verify/), so they start at once. scripts-test starts Collector
//     containers (scripts/test/obs-collector-*.test.mjs) under their own names, with temp-dir
//     mounts and no published ports, so it shares Docker with the DB tests without a conflict.
//   - drift waits for pub-get: in full mode the Dart client check resolves offline from the pub
//     cache that pub-get fills, so the cache must be complete first.
//   - typecheck+lint+test requires pub-get (below) and runs next to drift: drift generates into
//     temp directories and node_modules/.cache only, and the DB tests serialise on
//     .verify/db-test.lock themselves. Its `dart test`/`dart analyze` read the same pub cache as
//     drift's offline `pub get` and build_runner; pub writes that cache atomically, and a clash
//     would crash drift (exit 2), never pass it. If it ever flakes, make drift wait for it too.
//   - build waits for typecheck+lint+test: two Turborepo runs at once would share .turbo/ and
//     its daemon, and build rewrites dist/ under running tests. boot requires build and takes the
//     DB test lock like the DB tests.

/**
 * @typedef {{ name: string, cmd: string, args: string[], docs?: boolean, full?: boolean,
 *   requires?: string, after?: string[] }} Step
 */

/**
 * @param {'fast' | 'full' | 'docs'} mode
 * @param {{ affected?: string[] }} [options] `['--affected']` when fast mode can compare to main
 * @returns {Step[]}
 */
export function verifySteps(mode, { affected = [] } = {}) {
  /** @type {Step[]} */
  const all = [
    {
      name: 'format',
      docs: true,
      cmd: 'pnpm',
      args: ['exec', 'biome', mode === 'fast' ? 'check' : 'ci', '.'],
    },
    { name: 'instructions', docs: true, cmd: 'node', args: ['scripts/check-instruction-size.mjs'] },
    {
      name: 'lint-root',
      docs: true,
      cmd: 'pnpm',
      // The cache is keyed on each file's content and the resolved config. That is enough only
      // while the root config uses single-file rules; a rule that reads other files (type-aware,
      // import resolution) would need the cache removed.
      args: [
        'exec',
        'eslint',
        '--max-warnings=0',
        '--cache',
        '--cache-strategy',
        'content',
        '--cache-location',
        '.verify/eslint-root.cache',
        '.',
      ],
    },
    // Fast mode leaves out the Docker suites unless their files changed (lib/script-tests.mjs).
    {
      name: 'scripts-test',
      docs: true,
      cmd: 'node',
      args: ['scripts/run-script-tests.mjs', ...(mode === 'fast' ? ['--fast'] : [])],
    },
    { name: 'file-length', docs: true, cmd: 'node', args: ['scripts/check-file-length.mjs'] },
    // Resolves the pub workspace from pubspec.lock without changing it (fast when up to date).
    {
      name: 'pub-get',
      cmd: 'node',
      args: ['scripts/dart.mjs', 'flutter', 'pub', 'get', '--enforce-lockfile'],
    },
    // Generated files and migrations match their sources (scripts/drift.config.mjs).
    {
      name: 'drift',
      after: ['pub-get'],
      cmd: 'node',
      args: ['scripts/check-drift.mjs', ...(mode === 'full' ? ['--full'] : [])],
    },
    {
      name: 'typecheck+lint+test',
      // `dart test` re-resolves the workspace and would rewrite pubspec.lock if pub-get failed.
      requires: 'pub-get',
      cmd: 'pnpm',
      args: [
        'exec',
        'turbo',
        'run',
        'typecheck',
        'lint',
        'test',
        '--output-logs=errors-only',
        // full never trusts the cache, so CI and pre-PR runs re-execute every task
        ...(mode === 'full' ? ['--force'] : affected),
      ],
    },
    // Full only: build every app and boot the built API against a real database
    // (apps/api/scripts/boot-check.ts; needs Docker like the DB tests).
    {
      name: 'build',
      full: true,
      after: ['typecheck+lint+test'],
      cmd: 'pnpm',
      args: ['exec', 'turbo', 'run', 'build', '--output-logs=errors-only', '--force'],
    },
    {
      name: 'boot',
      full: true,
      requires: 'build',
      cmd: 'pnpm',
      args: ['--filter', '@shifa/api', 'run', 'boot-check'],
    },
  ];
  return all.filter((step) => (mode === 'docs' ? step.docs : mode === 'full' || !step.full));
}

/**
 * Runs `steps` as early as their dependencies allow (see the module comment). A dependency must
 * be declared before the step that names it. `exec` runs one step; a throw counts as a failure.
 * @template {Step} S
 * @param {S[]} steps
 * @param {(step: S) => Promise<{ code: number, output: string }>} exec
 * @param {{ now?: () => number }} [options]
 * @returns {Promise<Array<S & { code: number, output: string, seconds: string, skipped: boolean }>>}
 */
export function runSteps(steps, exec, { now = () => performance.now() } = {}) {
  const waitsOf = (step) => [...(step.after ?? []), ...(step.requires ? [step.requires] : [])];
  // Checked before anything starts, so a bad graph runs no step at all.
  const index = new Map(steps.map((s, i) => [s.name, i]));
  for (const [i, step] of steps.entries()) {
    for (const dep of waitsOf(step)) {
      if (index.has(dep) && /** @type {number} */ (index.get(dep)) >= i) {
        return Promise.reject(new Error(`verify: step ${step.name} must come after ${dep}`));
      }
    }
  }
  /** @type {Map<string, Promise<{ code: number }>>} */
  const started = new Map();
  for (const step of steps) {
    const pending = waitsOf(step)
      .filter((dep) => started.has(dep))
      .map((dep) => started.get(dep));
    started.set(
      step.name,
      Promise.all(pending).then(async () => {
        const prerequisite = step.requires ? await started.get(step.requires) : undefined;
        if (prerequisite && prerequisite.code !== 0) {
          const output = `skipped: ${step.requires} failed\n`;
          return { ...step, code: 1, output, seconds: '0.0', skipped: true };
        }
        const t0 = now();
        let outcome;
        try {
          outcome = await exec(step);
        } catch (err) {
          outcome = { code: 1, output: `${err?.stack ?? err}\n` };
        }
        const seconds = ((now() - t0) / 1000).toFixed(1);
        return { ...step, code: outcome.code, output: outcome.output, seconds, skipped: false };
      }),
    );
  }
  return Promise.all(steps.map((s) => started.get(s.name)));
}
