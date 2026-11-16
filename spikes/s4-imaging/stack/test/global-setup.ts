// Before a suite: remove containers and networks left by earlier runs that never reached their
// teardown (a timed-out beforeAll, Ctrl-C, S4_KEEP=1). Suites run one at a time, so no live
// run is touched; leaked bridge networks would otherwise exhaust Docker's address pools.
import { removeRun } from '../src/containers.ts';

export default async function setup(): Promise<void> {
  await removeRun('*');
}
