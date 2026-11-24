// verify's `e2e` step (slice A-01-06), kept apart from scripts/run-e2e.mjs so scripts/test can
// check the plan. Full mode runs the journeys on the build verify just made; fast mode runs them
// only when Turborepo's --affected reaches @shifa/e2e (an app, the web shell, the API or e2e/
// changed since main), building what they need first, and otherwise says why it skipped.

export const E2E_PACKAGE = '@shifa/e2e';

/**
 * True when `turbo ls --affected --output=json` lists @shifa/e2e.
 * @param {string} json
 */
export function e2eAffected(json) {
  const parsed = JSON.parse(json);
  const items = parsed?.packages?.items;
  if (!Array.isArray(items)) throw new Error('turbo ls: no packages.items in its output');
  return items.some((item) => item?.name === E2E_PACKAGE);
}

const RUN = { cmd: 'pnpm', args: ['--filter', E2E_PACKAGE, 'run', 'e2e'] };

/**
 * @param {{ fast: boolean, affected?: boolean }} options
 * @returns {Array<{ cmd: string, args: string[] } | { note: string }>}
 */
export function e2ePlan({ fast, affected = false }) {
  if (!fast) return [RUN];
  if (!affected) return [{ note: 'e2e skipped: nothing it covers changed since main' }];
  return [
    {
      cmd: 'pnpm',
      args: [
        'exec',
        'turbo',
        'run',
        'build',
        `--filter=${E2E_PACKAGE}...`,
        '--output-logs=errors-only',
      ],
    },
    RUN,
  ];
}
