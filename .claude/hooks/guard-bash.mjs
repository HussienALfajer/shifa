#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): refuses shell writes into source folders,
// skipping git hooks, force pushes, pushes to main and permission bypasses.
// Fails closed: any unexpected error blocks the call.
import { block, readEvent } from './lib/io.mjs';
import { checkBash } from './lib/policy.mjs';

try {
  const event = await readEvent({ failClosed: true });
  const command = event.tool_input?.command;
  if (typeof command !== 'string') process.exit(0);
  const reason = checkBash(command);
  if (reason) block(reason);
} catch (err) {
  block(
    `the shell guard failed (${err instanceof Error ? err.message : String(err)}), so the call is refused.`,
  );
}
