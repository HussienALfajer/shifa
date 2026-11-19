// Spike receiver HTTP server (node:http only), bound to 127.0.0.1 by default; the emulator reaches
// it at 10.0.2.2. Every request is logged by method, path (no query) and status; bodies never are.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { openReceiver, type Receiver } from './inbox.ts';
import { deviceReportSchema, type RequestLogLine, receiptSchema } from './schemas.ts';

const MAX_BODY = 64 * 1024;

export interface ReceiverServer {
  url: string;
  port: number;
  receiver: Receiver;
  close: () => Promise<void>;
}

export interface ServerOptions {
  dir: string;
  host?: string;
  port?: number;
  now?: () => Date;
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'body too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** The live-queue line comes from the poll, not from push (MSG-30). Synthetic and fixed. */
const QUEUE = { ahead: 3, text: 'دورك بعد ٣' };

async function route(
  receiver: Receiver,
  req: IncomingMessage,
  res: ServerResponse,
  now: () => Date,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://receiver.local');
  const key = `${req.method ?? 'GET'} ${url.pathname}`;
  switch (key) {
    case 'GET /time':
      json(res, 200, { now: now().getTime() });
      return;
    case 'GET /queue':
      json(res, 200, QUEUE);
      return;
    case 'GET /inbox': {
      const installId = url.searchParams.get('installId');
      if (!installId) throw new HttpError(400, 'installId is required');
      const since = url.searchParams.get('since') ?? undefined;
      if (since !== undefined && Number.isNaN(Date.parse(since)))
        throw new HttpError(400, 'since must be an ISO time');
      json(res, 200, { items: await receiver.inbox(installId, since) });
      return;
    }
    case 'POST /devices': {
      const parsed = deviceReportSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid device report');
      await receiver.reportDevice(parsed.data);
      res.writeHead(204).end();
      return;
    }
    case 'POST /receipts': {
      const parsed = receiptSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(400, 'invalid receipt');
      await receiver.addReceipt(parsed.data);
      res.writeHead(204).end();
      return;
    }
    default:
      throw new HttpError(404, 'not found');
  }
}

export async function startServer(opts: ServerOptions): Promise<ReceiverServer> {
  const now = opts.now ?? (() => new Date());
  const receiver = openReceiver(opts.dir, now);
  const server = createServer((req, res) => {
    const started = Date.now();
    route(receiver, req, res, now)
      .catch((e: unknown) => {
        // Validation messages are fixed strings: no request content is echoed back or logged.
        const status = e instanceof HttpError ? e.status : 500;
        if (!res.headersSent)
          json(res, status, { error: e instanceof HttpError ? e.message : 'error' });
      })
      .finally(() => {
        const line: RequestLogLine = {
          at: now().toISOString(),
          method: req.method ?? 'GET',
          path: new URL(req.url ?? '/', 'http://receiver.local').pathname,
          status: res.statusCode,
          ms: Date.now() - started,
        };
        void receiver.store.append('requests', line);
      });
  });
  const host = opts.host ?? '127.0.0.1';
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, host, resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://${host}:${String(port)}`,
    port,
    receiver,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      // Let pending log lines land before the directory is reused or removed.
      await receiver.store.readAll('requests');
    },
  };
}
