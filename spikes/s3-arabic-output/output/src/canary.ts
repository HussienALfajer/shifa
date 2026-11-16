// The canary: a tiny HTTP server on Gotenberg's network that counts the requests it receives.
// A render that loads anything from the network (web fonts, a CDN, a probe URL) shows up here.
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { TestNetwork } from './network.ts';

/** busybox httpd, pinned by digest; it logs every request line to stdout with -v. */
export const CANARY_IMAGE =
  'busybox:1.37.0@sha256:a7dbc319b1438115a207e11930dc4bb3e643dcb3ec0bdd694bb36cd8fad289ec';
const ALIAS = 'canary';

export interface Canary {
  /** Base URL as seen from inside the network. */
  url: string;
  requests(): Promise<number>;
  /** Sends one request to the canary's alias from inside its container; true if answered. */
  selfCheck(): Promise<boolean>;
  stop(): Promise<void>;
}

export async function startCanary({ network }: TestNetwork): Promise<Canary> {
  const container: StartedTestContainer = await new GenericContainer(CANARY_IMAGE)
    .withNetwork(network)
    .withNetworkAliases(ALIAS)
    .withCommand([
      'sh',
      '-c',
      'mkdir -p /www && echo ok > /www/index.html && exec httpd -f -v -p 80 -h /www',
    ])
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const requests = async (): Promise<number> => {
    const stream = await container.logs();
    const lines: string[] = [];
    await new Promise<void>((resolve) => {
      stream.on('data', (chunk: Buffer | string) => lines.push(String(chunk)));
      setTimeout(() => {
        stream.destroy();
        resolve();
      }, 500);
    });
    // httpd -v prints one "response:" line per request served (any status).
    return lines
      .join('')
      .split('\n')
      .filter((line) => /response:\d{3}/.test(line)).length;
  };

  return {
    url: `http://${ALIAS}`,
    requests,
    selfCheck: async () => {
      const result = await container.exec(['wget', '-q', '-O', '-', `http://${ALIAS}/`]);
      return result.exitCode === 0 && result.output.includes('ok');
    },
    stop: async () => {
      await container.stop();
    },
  };
}
