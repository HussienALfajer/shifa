#!/usr/bin/env node
// SessionEnd: warns when the session leaves uncommitted work behind.
import { git, projectDir, readEvent } from './lib/io.mjs';

const event = await readEvent();
const root = projectDir(event);
try {
  const status = git(['status', '--porcelain'], root).trim();
  if (status) {
    const count = status.split('\n').length;
    process.stderr.write(
      `Warning: ${count} uncommitted change(s) left in the working tree. Commit them at a green checkpoint or note them in the slice file.\n`,
    );
  }
} catch {
  // not a git checkout; nothing to report
}
process.exit(0);
