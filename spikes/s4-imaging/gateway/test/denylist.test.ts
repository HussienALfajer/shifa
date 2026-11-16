// Criterion 6: the gateway refuses by default. Orthanc REST routes, the upstream /dicom-web
// spelling, path traversal (plain and encoded), unknown routes and other methods on allowed
// paths are refused with a valid token, and none of them reaches an Orthanc. Requests go out
// through node:http so the client does not normalise the paths first.
import { request } from 'node:http';
import { useStack } from '@shifa-spike/s4-stack/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';

const stack = useStack();
let viewer = '';
let uploader = '';

function raw(method: string, path: string, headers: Record<string, string>): Promise<number> {
  const url = new URL(stack.gatewayUrl);
  return new Promise((resolve, reject) => {
    const req = request(
      { host: url.hostname, port: url.port, method, path, headers, agent: false },
      (res) => {
        res.resume();
        res.on('end', () => {
          resolve(res.statusCode ?? 0);
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  viewer = await stack.token({ tenant: 'a', role: 'viewer' });
  uploader = await stack.token({ tenant: 'a', role: 'uploader' });
});

const STUDY = '/dicomweb/studies/1.2.826.0.1.3680043.2.1';

describe('gateway route denylist', () => {
  it('refuses Orthanc REST, upstream spellings, traversal and other methods, upstream untouched', async () => {
    const refused: [string, string][] = [
      ...[
        '/tools/find',
        '/tools/execute-script',
        '/system',
        '/instances',
        '/plugins',
        '/jobs',
        '/patients',
        '/studies',
        '/statistics',
        '/transfers/send',
        '/dicom-web/studies',
        '/dicom-web/servers',
        '/dicomweb/servers',
        '/dicomweb/../system',
        '/dicomweb/%2e%2e/system',
        '/dicomweb/%2E%2E/tools/find',
        '/dicomweb/studies/..%2f..%2fsystem',
        '/dicomweb//studies',
        '/dicomweb/studies/abc',
        '/dicomweb/studies/1.2.3/series/1.2.4/instances/1.2.5/bulk/7FE00010',
        '/dicomweb/studies/1.2.3/thumbnail',
        '/',
        '/app',
      ].map((path): [string, string] => ['GET', path]),
      ['OPTIONS', '/dicomweb/studies'],
      ['DELETE', STUDY],
      ['PUT', STUDY],
      ['PATCH', STUDY],
      ['POST', `${STUDY}/series`],
      ['POST', '/tools/execute-script'],
    ];
    const before = await stack.gateway.metrics();
    const allowedStatuses = [400, 404, 405];
    for (const [method, path] of refused) {
      for (const token of [viewer, uploader]) {
        const status = await raw(method, path, bearer(token));
        expect(allowedStatuses, `${method} ${path}`).toContain(status);
      }
    }
    const after = await stack.gateway.metrics();
    expect(after.upstream).toBe(before.upstream);
    expect(after.audited).toBe(before.audited);
  });

  it('still serves the health check without a token and without an upstream call', async () => {
    const before = await stack.gateway.metrics();
    expect(await raw('GET', '/healthz', {})).toBe(200);
    expect((await stack.gateway.metrics()).upstream).toBe(before.upstream);
  });
});
