// Pure logic for the PR size budget (docs/process/development-workflow.md §6).
// Counts hand-written changed lines (added + deleted); generated and binary files are excluded.

export const WARN_LINES = 1000;
export const FAIL_LINES = 2000;

/** Paths that are always generated, in addition to files marked linguist-generated. */
const ALWAYS_GENERATED = [/(^|\/)pnpm-lock\.yaml$/, /(^|\/)pubspec\.lock$/];

/**
 * @param {string} numstat output of `git diff --numstat`
 * @param {Set<string>} generated paths marked linguist-generated
 */
export function measure(numstat, generated) {
  let counted = 0;
  let excluded = 0;
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue;
    const [added, deleted, ...rest] = line.split('\t');
    const path = rest.join('\t');
    // Binary files report "-" for both counts.
    if (added === '-' || deleted === '-') {
      excluded += 1;
      continue;
    }
    if (generated.has(path) || ALWAYS_GENERATED.some((re) => re.test(path))) {
      excluded += 1;
      continue;
    }
    counted += Number(added) + Number(deleted);
  }
  return { counted, excluded };
}

/**
 * @param {number} counted
 * @param {boolean} override the owner applied the `size/override` label
 * @returns {{ level: 'ok' | 'warn' | 'fail', message: string }}
 */
export function judge(counted, override) {
  if (counted > FAIL_LINES && !override) {
    return {
      level: 'fail',
      message: `PR changes ${counted} hand-written lines (limit ${FAIL_LINES}). Split the slice, or the owner adds the "size/override" label.`,
    };
  }
  if (counted > WARN_LINES) {
    return {
      level: 'warn',
      message: `PR changes ${counted} hand-written lines (budget ${WARN_LINES})${override ? '; owner override applied' : ''}.`,
    };
  }
  return {
    level: 'ok',
    message: `PR changes ${counted} hand-written lines (budget ${WARN_LINES}).`,
  };
}
