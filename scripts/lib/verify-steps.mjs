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
//     temp directories and node_modules/.cache only, and each DB test run takes one of a few
//     slots (.verify/db-test.lock.<n>) with containers of its own. Its `dart test` and
//     `dart analyze` read the same pub cache as drift's offline `pub get` and build_runner;
//     pub writes that cache atomically, and a clash
//     would crash drift (exit 2), never pass it. If it ever flakes, make drift wait for it too.
//   - build waits for typecheck+lint+test: two Turborepo runs at once would share .turbo/ and
//     its daemon, and build rewrites dist/ under running tests. boot requires build and takes a
//     DB test slot like the DB tests.

/**
 * @typedef {{ name: string, cmd: string, args: string[], docs?: boolean, full?: boolean,
 *   requires?: string, after?: string[] }} Step
 */

/**
 * CI splits `verify full` into parallel jobs (OD-34). Together with the `docs` mode (the
 * repository-level steps) the parts cover every full step:
 *   node  — Turborepo typecheck/lint/test of every package outside the pub workspace;
 *   dart  — pub-get, drift and Turborepo typecheck/lint/test of the pub workspace packages;
 *   build — build and the API boot check;
 *   ui    — the browser checks of packages/ui: component tests, the Storybook test run (axe),
 *           the Storybook build and the screenshot comparison in the pinned image (Docker);
 *   e2e   — the build again (its own job), then the Playwright journeys against the built API,
 *           a harness database and the built apps (slice A-01-06; Docker and Chromium).
 */
export const PARTS = Object.freeze(['node', 'dart', 'build', 'ui', 'e2e']);

/** The steps of the `ui` part, in order (full mode only; fast mode runs no browser). */
const UI_STEPS = ['ui-browser', 'ui-storybook', 'ui-storybook-build', 'ui-screenshots'];

/**
 * @param {'fast' | 'full' | 'docs'} mode
 * @param {{ affected?: string[], part?: string, dartPackages?: string[] }} [options]
 *   `affected`: `['--affected']` when fast mode can compare to main; `part`: one of PARTS (full
 *   mode only), with `dartPackages` the Turborepo names of the pub workspace members
 * @returns {Step[]}
 */
export function verifySteps(mode, { affected = [], part, dartPackages = [] } = {}) {
  const steps = allSteps(mode, affected);
  if (part === undefined) return steps;
  if (mode !== 'full') throw new Error(`verify: --part needs full mode, not ${mode}`);
  if (!PARTS.includes(part)) throw new Error(`verify: unknown part "${part}"`);
  if (dartPackages.length === 0) throw new Error('verify: no pub workspace packages to split by');
  const byName = Object.fromEntries(steps.map((s) => [s.name, s]));
  const turbo = byName['typecheck+lint+test'];
  if (part === 'build') return [byName.build, byName.boot];
  if (part === 'e2e') return [byName.build, byName.e2e];
  if (part === 'ui') return UI_STEPS.map((name) => byName[name]);
  if (part === 'node') {
    // No pub-get here: no task outside the pub workspace runs Dart.
    const nodeTurbo = {
      ...turbo,
      args: [...turbo.args, ...dartPackages.map((p) => `--filter=!${p}`)],
    };
    delete nodeTurbo.requires;
    return [nodeTurbo];
  }
  const dartTurbo = {
    ...turbo,
    args: [...turbo.args, ...dartPackages.map((p) => `--filter=${p}`)],
  };
  return [byName['pub-get'], byName.drift, dartTurbo];
}

/**
 * @param {'fast' | 'full' | 'docs'} mode
 * @param {string[]} affected
 * @returns {Step[]}
 */
function allSteps(mode, affected) {
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
    // Full only (slice 0.4-03): packages/ui in Chromium. Each waits for the one before, so two
    // browsers and two Vite servers never compete for the machine; the screenshots compare the
    // Storybook just built, in the pinned Playwright image (needs Docker).
    {
      name: 'ui-browser',
      full: true,
      after: ['build'],
      cmd: 'pnpm',
      args: ['--filter', '@shifa/ui', 'test:browser'],
    },
    {
      name: 'ui-storybook',
      full: true,
      after: ['ui-browser'],
      cmd: 'pnpm',
      args: ['--filter', '@shifa/ui', 'test:storybook'],
    },
    {
      name: 'ui-storybook-build',
      full: true,
      after: ['ui-storybook'],
      cmd: 'pnpm',
      args: ['--filter', '@shifa/ui', 'storybook:build'],
    },
    {
      name: 'ui-screenshots',
      full: true,
      requires: 'ui-storybook-build',
      cmd: 'pnpm',
      args: ['--filter', '@shifa/ui', 'screenshots'],
    },
    // The journeys (slice A-01-06, scripts/lib/e2e.mjs): full mode on the build above, after the
    // ui browser steps (one browser and its Vite servers at a time); fast mode (no build or ui
    // step) only when --affected reaches @shifa/e2e, building what they need itself, so it waits
    // for the Turborepo run (one at a time). Takes a DB test slot like boot.
    {
      name: 'e2e',
      requires: 'build',
      after: ['typecheck+lint+test', 'ui-screenshots'],
      cmd: 'node',
      args: ['scripts/run-e2e.mjs', ...(mode === 'fast' ? ['--fast'] : [])],
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
