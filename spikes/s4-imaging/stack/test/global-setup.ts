// Before a suite: remove containers and networks left by earlier runs that never reached their
// teardown (a timed-out beforeAll, Ctrl-C, S4_KEEP=1), so leaked bridge networks do not exhaust
// Docker's address pools. Only runs whose owner process is gone are removed: a suite running
// in parallel, in this or another worktree on the same Docker host, keeps its stack.
import { removeStaleRuns } from '../src/containers.ts';

export default async function setup(): Promise<void> {
  await removeStaleRuns();
}
