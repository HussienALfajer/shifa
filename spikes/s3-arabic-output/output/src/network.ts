// One Testcontainers network per test file: Gotenberg and the canary share it. It is an ordinary
// bridge with internet access: what keeps Chromium off the network is Gotenberg's allow and
// deny lists, which the canary test probes.
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
