// Pure logic for the PR size budget (docs/process/development-workflow.md §6).
// Counts hand-written changed lines (added + deleted); generated and binary files are excluded.

export const WARN_LINES = 1000;
export const FAIL_LINES = 2000;

/** Paths that are always generated, in addition to files marked linguist-generated. */
const ALWAYS_GENERATED = [/(^|\/)pnpm-lock\.yaml$/, /(^|\/)pubspec\.lock$/];

/**
 * Parses `git diff -z --numstat -M`. Records are `added\tdeleted\tpath\0`, or for a rename
 * `added\tdeleted\t\0old\0new\0`; the new path is used. Binary files report "-" counts.
 * @param {string} raw
 * @returns {{ added: number | null, deleted: number | null, path: string }[]}
 */
export function parseNumstatZ(raw) {
  const tokens = raw.split('\0');
  const entries = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const head = tokens[i];
    if (!head) continue;
    const [added, deleted, path] = head.split('\t');
    let finalPath = path ?? '';
    if (finalPath === '') {
      // rename: the next two tokens are old and new path
      finalPath = tokens[i + 2] ?? '';
      i += 2;
    }
    entries.push({
      added: added === '-' ? null : Number(added),
      deleted: deleted === '-' ? null : Number(deleted),
      path: finalPath,
    });
  }
  return entries;
}

/**
 * @param {{ added: number | null, deleted: number | null, path: string }[]} entries
 * @param {Set<string>} generated paths marked linguist-generated (read from the base branch)
 */
export function measure(entries, generated) {
  let counted = 0;
  let excluded = 0;
  for (const { added, deleted, path } of entries) {
    if (added === null || deleted === null) {
      excluded += 1;
      continue;
    }
    if (generated.has(path) || ALWAYS_GENERATED.some((re) => re.test(path))) {
      excluded += 1;
      continue;
    }
    counted += added + deleted;
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
