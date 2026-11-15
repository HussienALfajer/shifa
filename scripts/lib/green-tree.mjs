// "This exact tree already passed verify": a fingerprint of HEAD, the status and the diff,
// shared by scripts/verify.mjs (writes it after an all-green run) and the Stop hook
// (.claude/hooks/stop-verify.mjs skips a tree that matches it). Without the shared record, a
// green `pnpm verify` was followed by the hook running the same checks on the same tree again.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Where the last green fingerprint lives (git-ignored, one per worktree). */
export function greenFile(root) {
  return join(root, '.claude', 'state', 'last-green-verify');
}

/** @returns {Buffer} raw output (diffs may hold binary data) */
function gitRaw(args, root) {
  return execFileSync('git', args, {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

const git = (args, root) => gitRaw(args, root).toString('utf8');

/** The local `main` commit, or '' when there is none: fast verify's `--affected` compares to it. */
function mainRef(root) {
  try {
    return git(['rev-parse', '--verify', '--quiet', 'main'], root);
  } catch {
    return '';
  }
}

/**
 * sha256 of HEAD, the local `main`, `git status --porcelain --untracked-files=all`, `git diff
 * HEAD` (no external diff drivers or textconv, binary changes included) and the name and content
 * of every untracked, not-ignored file, or null when git cannot answer (not a repository, no
 * commit yet). Ignored files are not part of the tree.
 * @param {string} root
 * @returns {{ fingerprint: string, status: string } | null}
 */
export function treeState(root) {
  try {
    const status = git(['status', '--porcelain', '--untracked-files=all'], root);
    const hash = createHash('sha256')
      .update(git(['rev-parse', 'HEAD'], root))
      .update(`\0main:${mainRef(root)}\0`)
      .update(status)
      .update(gitRaw(['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD'], root));
    const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root)
      .split('\0')
      .filter(Boolean)
      .sort();
    for (const name of untracked) {
      hash.update(`\0untracked:${name}\0`);
      try {
        hash.update(readFileSync(join(root, name)));
      } catch {
        hash.update('\0unreadable\0');
      }
    }
    return { fingerprint: hash.digest('hex'), status };
  } catch {
    return null;
  }
}

/** True when `fingerprint` is the recorded green tree. */
export function isGreen(root, fingerprint) {
  const file = greenFile(root);
  return (
    Boolean(fingerprint) && existsSync(file) && readFileSync(file, 'utf8').trim() === fingerprint
  );
}

export function recordGreen(root, fingerprint) {
  const file = greenFile(root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, fingerprint);
}
