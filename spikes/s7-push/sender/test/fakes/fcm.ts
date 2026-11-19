// Fake FCM HTTP v1 endpoint (`POST /v1/projects/{id}/messages:send`). Answers 200 with a message
// name unless a scripted response is queued; `onRequest` runs before the answer so a test can
// check what already exists (the inbox record) when the request arrives.
import { createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

export interface FcmRequest {
  path: string;
  authorization: string | undefined;
  body: {
    message: Record<string, unknown> & {
      token?: string;
      data?: { s7id?: string; sentAt?: string; appointmentId?: string; kind?: string };
    };
  };
}

export interface FakeFcm {
  url: string;
  requests: FcmRequest[];
  /** Queue one scripted answer; answers are used in order, then 200 resumes. */
  enqueue: (status: number, body: unknown) => void;
  close: () => Promise<void>;
}

export async function startFakeFcm(
  opts: { onRequest?: (req: FcmRequest) => Promise<void> | void } = {},
): Promise<FakeFcm> {
  const requests: FcmRequest[] = [];
  const scripted: { status: number; body: unknown }[] = [];
  let n = 0;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const entry: FcmRequest = {
        path: req.url ?? '',
        authorization: req.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as FcmRequest['body'],
      };
      requests.push(entry);
      void Promise.resolve(opts.onRequest?.(entry)).then(() => {
        const next = scripted.shift();
        n += 1;
        const status = next?.status ?? 200;
        const body = next ? next.body : { name: `projects/s7-fake/messages/0:${String(n)}` };
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    enqueue: (status, body) => scripted.push({ status, body }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** FCM's error body for a token that is no longer registered. */
export const unregistered = {
  error: {
    code: 404,
    message: 'Requested entity was not found.',
    status: 'NOT_FOUND',
    details: [
      { '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' },
    ],
  },
};

/** FCM's error body for a bad field (`message.token`, `message.fcm_options.analytics_label`). */
export const invalidArgument = (field: string) => ({
  error: {
    code: 400,
    message: `Invalid value at '${field}'`,
    status: 'INVALID_ARGUMENT',
    details: [
      {
        '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
        errorCode: 'INVALID_ARGUMENT',
      },
      {
        '@type': 'type.googleapis.com/google.rpc.BadRequest',
        fieldViolations: [{ field, description: 'Invalid value' }],
      },
    ],
  },
});
