// A local HTTP server that records requests and answers with scripted responses (no vendor).
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach } from 'vitest';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export interface ScriptedResponse {
  status: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
}

export interface MockServer {
  url: string;
  requests: RecordedRequest[];
  /** Responses served in order; the last one repeats. */
  respond: (...responses: ScriptedResponse[]) => void;
}

const servers: { close: () => void }[] = [];

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

export async function startMockServer(): Promise<MockServer> {
  const requests: RecordedRequest[] = [];
  let script: ScriptedResponse[] = [{ status: 500 }];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
      });
      const next = script.length > 1 ? script.shift() : script[0];
      res.writeHead(next?.status ?? 500, next?.headers ?? {});
      res.end(next?.body ?? '');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push({ close: () => server.close() });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    respond: (...responses) => {
      script = responses;
    },
  };
}
