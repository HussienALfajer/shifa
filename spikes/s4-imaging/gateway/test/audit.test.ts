// Criterion 6 (IMG-25): every allowed request writes exactly one audit row (actor, tenant,
// study, action, route class, status); refused requests write none.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy } from '@shifa-spike/s4-generator';
import { stowBody } from '@shifa-spike/s4-stack';
import { useStack } from '@shifa-spike/s4-stack/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';

const stack = useStack();
let client: pg.Client;

interface AuditRow {
  actor: string;
  tenant_id: string;
  study_uid: string | null;
  action: string;
  route_class: string;
  status: number;
}

const rows = async (): Promise<AuditRow[]> =>
  (
    await client.query<AuditRow>(
      'select actor, tenant_id, study_uid, action, route_class, status from s4.audit order by id',
    )
  ).rows;

beforeAll(async () => {
  const url = new URL(stack.postgres.url);
  url.pathname = '/s4_gateway';
  client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
});
afterAll(async () => {
  await client.end();
});

describe('gateway audit', () => {
  it('writes one row per allowed call and none for refused calls', async () => {
    const { dir, manifest } = await ensureStudy('cbct-20-multi');
    const [first] = manifest.files;
    if (!first) throw new Error('empty study');
    const uploader = await stack.token({ sub: 'up-a', tenant: 'a', role: 'uploader' });
    const viewer = await stack.token({ sub: 'viewer-a', tenant: 'a', role: 'viewer' });
    const study = manifest.studyInstanceUid;
    expect(await rows()).toEqual([]);

    const { body, contentType } = stowBody([await readFile(join(dir, first.path))]);
    const stow = await fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
      method: 'POST',
      body,
      headers: { ...bearer(uploader), 'content-type': contentType },
    });
    expect(stow.status).toBe(200);
    const get = (path: string) =>
      fetch(`${stack.gatewayUrl}${path}`, { headers: bearer(viewer) }).then((r) => r.arrayBuffer());
    await get('/dicomweb/studies');
    await get(`/dicomweb/studies/${study}/metadata`);
    await get(
      `/dicomweb/studies/${study}/series/${first.seriesInstanceUid}/instances/${first.sopInstanceUid}`,
    );
    await fetch(`${stack.gatewayUrl}/dicomweb/studies`).then((r) => r.arrayBuffer());
    await get('/system');

    expect(await rows()).toEqual([
      {
        actor: 'up-a',
        tenant_id: 'a',
        study_uid: study,
        action: 'store',
        route_class: 'stow',
        status: 200,
      },
      {
        actor: 'viewer-a',
        tenant_id: 'a',
        study_uid: null,
        action: 'search',
        route_class: 'qido-studies',
        status: 200,
      },
      {
        actor: 'viewer-a',
        tenant_id: 'a',
        study_uid: study,
        action: 'retrieve',
        route_class: 'wado-study-metadata',
        status: 200,
      },
      {
        actor: 'viewer-a',
        tenant_id: 'a',
        study_uid: study,
        action: 'retrieve',
        route_class: 'wado-instance',
        status: 200,
      },
    ]);
    expect((await stack.gateway.metrics()).audited).toBe(4);
  });
});
