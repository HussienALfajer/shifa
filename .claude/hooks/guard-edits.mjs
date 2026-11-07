#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): refuses edits to secrets, generated files,
// read-only evidence, accepted ADRs, committed migrations and the slice's locked tests.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { block, git, projectDir, readEvent } from './lib/io.mjs';
import { checkEdit, toRepoPath } from './lib/policy.mjs';

const event = await readEvent({ failClosed: true });
const input = event.tool_input ?? {};
const filePath = input.file_path ?? input.notebook_path;
if (!filePath) process.exit(0);

const root = projectDir(event);
const repoPath = toRepoPath(filePath, root);

let tracked;
try {
  git(['ls-files', '--error-unmatch', '--', repoPath], root);
  tracked = true;
} catch {
  tracked = false;
}

const lockedFile = join(root, '.claude', 'state', 'locked-tests.txt');
const lockedTests = existsSync(lockedFile)
  ? readFileSync(lockedFile, 'utf8')
      .split('\n')
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter((l) => l && !l.startsWith('#'))
  : [];

const reason = checkEdit(repoPath, { tracked, lockedTests });
if (reason) block(reason);
