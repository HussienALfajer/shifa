// Shared I/O for hook entry points: read the JSON event from stdin, find the project root.
import { execFileSync } from 'node:child_process';

/**
 * @param {{ failClosed?: boolean }} [options] guards pass failClosed so an unreadable event
 *   blocks the tool call instead of silently allowing it
 */
export async function readEvent({ failClosed = false } = {}) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    if (failClosed) block('the hook could not parse the tool event, so the call is refused.');
    return {};
  }
}

export function projectDir(event) {
  return process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
}

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Blocks the tool call: exit code 2 sends the reason back to Claude. */
export function block(reason) {
  process.stderr.write(`Blocked by project hook: ${reason}\n`);
  process.exit(2);
}
