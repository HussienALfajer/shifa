// Criterion 9 and IMG-03 at the gateway: the Transfers push routes (create, bucket PUT,
// commit, abort) are allowed for an edge credential only and go to the edge token's tenant's
// Orthanc; viewer and uploader tokens are refused; Transfers pull, send, lookup, peers and
// chunks, Orthanc jobs and peers are refused for every role. One audit row per committed push.
// An edge credential may live up to 12 hours (a P1 push outlasts the 5-minute user tokens).
import { ensureStudy, type Manifest } from '@shifa-spike/s4-generator';
import { orthanc, sha256, useStack } from '@shifa-spike/s4-stack/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';

const stack = useStack({ edge: true });
let study: { dir: string; manifest: Manifest };
let db: pg.Client;
const TX = '0f8ad8df-70178275-b56cfc7f-6e86ba74-139640d8';

const call = (method: string, path: string, token: string) =>
  fetch(`${stack.gatewayUrl}${path}`, {
    method,
    headers: bearer(token),
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
  });

beforeAll(async () => {
  study = await ensureStudy('cbct-20-multi');
  const url = new URL(stack.postgres.url);
  url.pathname = '/s4_gateway';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
});
afterAll(async () => {
  await db.end();
});

describe('edge push through the gateway', () => {
  it("pushes a study from the edge Orthanc into the edge tenant's Orthanc only", async () => {
    const files = study.manifest.files.slice(0, 5);
    const edge = stack.edge;
    if (!edge) throw new Error('no edge');
    await edge.storescu(
      study.dir,
      files.map((f) => f.path),
    );
    const job = await edge.push(study.manifest.studyInstanceUid);
    const done = await edge.waitJob(job, 300_000);
    expect(done.State).toBe('Success');
    const ids = (await (await orthanc(stack.tenants.a, '/instances')).json()) as string[];
    expect(ids).toHaveLength(5);
    const hashes = await Promise.all(
      ids.map(async (id) =>
        sha256(
          new Uint8Array(
            await (await orthanc(stack.tenants.a, `/instances/${id}/file`)).arrayBuffer(),
          ),
        ),
      ),
    );
    expect(hashes.sort()).toEqual(files.map((f) => f.sha256).sort());
    expect(await (await orthanc(stack.tenants.b, '/instances')).json()).toEqual([]);
    const audit = await db.query<{ actor: string; tenant_id: string; action: string }>(
      "select actor, tenant_id, action from s4.audit where action = 'push'",
    );
    expect(audit.rows).toEqual([{ actor: 'edge-a', tenant_id: 'a', action: 'push' }]);
  });

  it('refuses the push routes to viewer and uploader tokens, upstream untouched', async () => {
    const before = await stack.gateway.metrics();
    for (const role of ['viewer', 'uploader'] as const) {
      const token = await stack.token({ tenant: 'a', role });
      for (const [method, path] of [
        ['POST', '/transfers/push'],
        ['PUT', `/transfers/push/${TX}/0`],
        ['POST', `/transfers/push/${TX}/commit`],
        ['DELETE', `/transfers/push/${TX}`],
      ] as const) {
        expect((await call(method, path, token)).status, `${role} ${method} ${path}`).toBe(403);
      }
    }
    const after = await stack.gateway.metrics();
    expect(after.upstream).toBe(before.upstream);
    expect(after.audited).toBe(before.audited);
  });

  it('refuses Transfers pull, send, lookup, peers and chunks, jobs and peers for every role', async () => {
    const before = await stack.gateway.metrics();
    const tokens = await Promise.all(
      (['viewer', 'uploader', 'edge'] as const).map((role) =>
        stack.token({ tenant: 'a', role, ttlSeconds: 120 }),
      ),
    );
    const refused: [string, string][] = [
      ['GET', '/transfers/peers'],
      ['GET', '/transfers/info'],
      ['POST', '/transfers/send'],
      ['POST', '/transfers/pull'],
      ['POST', '/transfers/lookup'],
      ['GET', `/transfers/chunks/${TX}`],
      ['GET', `/transfers/push/${TX}`],
      ['PUT', `/transfers/push/${TX}/0/extra`],
      ['PUT', `/transfers/push/${TX}/x`],
      ['POST', '/transfers/push/../../tools/execute-script'],
      ['GET', '/plugins/transfers'],
      ['GET', '/jobs'],
      ['GET', '/peers'],
    ];
    for (const token of tokens) {
      for (const [method, path] of refused) {
        expect([400, 404], `${method} ${path}`).toContain((await call(method, path, token)).status);
      }
    }
    const after = await stack.gateway.metrics();
    expect(after.upstream).toBe(before.upstream);
  });

  it('accepts an edge credential up to 12 hours and no longer', async () => {
    const ok = await stack.token({ sub: 'edge-a', tenant: 'a', role: 'edge', ttlSeconds: 43_000 });
    const res = await call('POST', '/transfers/push', ok);
    // Allowed and forwarded: Orthanc refuses the empty transaction itself.
    expect(res.status).toBe(400);
    const tooLong = await stack.token({ tenant: 'a', role: 'edge', ttlSeconds: 13 * 3600 });
    expect((await call('POST', '/transfers/push', tooLong)).status).toBe(401);
    const longViewer = await stack.token({ tenant: 'a', role: 'viewer', ttlSeconds: 3600 });
    expect((await call('GET', '/dicomweb/studies', longViewer)).status).toBe(401);
  });
});
