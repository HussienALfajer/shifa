// Fake Google OAuth token endpoint: checks the JWT-bearer grant against the fake key's public
// half and hands out numbered access tokens. CI never reaches oauth2.googleapis.com.
import { createVerify, type KeyObject } from 'node:crypto';
import { createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

export interface FakeTokenServer {
  url: string;
  /** Number of token requests served (good or bad). */
  calls: () => number;
  /** The decoded assertions received, newest last. */
  assertions: string[];
  /** Next request answers with this status and body instead of a token. */
  failNext: (status: number, body: unknown) => void;
  close: () => Promise<void>;
}

export async function startFakeTokenServer(opts: {
  publicKey: KeyObject;
  expiresIn?: number;
}): Promise<FakeTokenServer> {
  let calls = 0;
  let failure: { status: number; body: unknown } | undefined;
  const assertions: string[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      calls += 1;
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (failure) {
        const f = failure;
        failure = undefined;
        send(f.status, f.body);
        return;
      }
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const assertion = form.get('assertion') ?? '';
      if (form.get('grant_type') !== 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
        send(400, { error: 'unsupported_grant_type' });
        return;
      }
      const [header = '', payload = '', signature = ''] = assertion.split('.');
      const verifier = createVerify('RSA-SHA256');
      verifier.update(`${header}.${payload}`);
      if (!verifier.verify(opts.publicKey, Buffer.from(signature, 'base64url'))) {
        send(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
        return;
      }
      assertions.push(assertion);
      send(200, {
        access_token: `fake-access-${String(calls)}`,
        expires_in: opts.expiresIn ?? 3600,
        token_type: 'Bearer',
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/token`,
    calls: () => calls,
    assertions,
    failNext: (status, body) => {
      failure = { status, body };
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
