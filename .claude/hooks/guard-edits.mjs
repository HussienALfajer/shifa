#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): refuses edits to secrets, generated files,
// read-only evidence, accepted ADRs, merged migrations and the slice's locked tests.
// Fails closed: any unexpected error blocks the call.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { block, git, projectDir, readEvent } from './lib/io.mjs';
import { checkEdit, isStatusLineEdit, toRepoPath } from './lib/policy.mjs';

try {
  const event = await readEvent({ failClosed: true });
  const input = event.tool_input ?? {};
  const filePath = input.file_path ?? input.notebook_path;
  if (!filePath) process.exit(0);

  const root = projectDir(event);
  const repoPath = toRepoPath(filePath, root);

  // Merged work is protected; work on the slice branch is not.
  const mainCopy = (() => {
    for (const ref of ['main', 'origin/main']) {
      try {
        return git(['show', `${ref}:${repoPath}`], root);
      } catch {
        // not on this ref
      }
    }
    return null;
  })();

  const edits = Array.isArray(input.edits) ? input.edits : [input];
  const statusLineOnly =
    event.tool_name !== 'Write' &&
    edits.length > 0 &&
    edits.every((e) => isStatusLineEdit(e.old_string, e.new_string));

  const lockedFile = join(root, '.claude', 'state', 'locked-tests.txt');
  const lockedTests = existsSync(lockedFile)
    ? readFileSync(lockedFile, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => toRepoPath(l, root))
    : [];

  const reason = checkEdit(repoPath, {
    onMain: mainCopy !== null,
    acceptedOnMain: mainCopy !== null && /^Status:\s*Accepted/m.test(mainCopy),
    statusLineOnly,
    lockedTests,
  });
  if (reason) block(reason);
} catch (err) {
  block(
    `the edit guard failed (${err instanceof Error ? err.message : String(err)}), so the call is refused.`,
  );
}
