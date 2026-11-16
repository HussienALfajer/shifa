// One Testcontainers network per test file: Gotenberg and the canary share it, nothing else.
import { Network, type StartedNetwork } from 'testcontainers';

export interface TestNetwork {
  network: StartedNetwork;
  stop(): Promise<void>;
}

export async function startNetwork(): Promise<TestNetwork> {
  const network = await new Network().start();
  return {
    network,
    stop: async () => {
      await network.stop();
    },
  };
}
