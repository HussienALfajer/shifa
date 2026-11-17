// Before a suite: remove containers and networks left by earlier runs whose owner process is
// gone (a timed-out beforeAll, Ctrl-C), so leaked networks do not exhaust Docker's pools.
import { removeStaleRuns } from '../src/containers.ts';

export default async function setup(): Promise<void> {
  await removeStaleRuns();
}
