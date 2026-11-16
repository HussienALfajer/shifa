// Criterion 6 (IMG-03): the same study (same UIDs) stored by tenants A and B stays two studies,
// one per Orthanc. With A's tokens, QIDO lists none of B's studies, WADO on B's UIDs answers
// exactly like an unknown UID, and STOW lands in A only. Expired, forged, alg-none, claim-less,
// unknown-tenant, over-long and wrong-role tokens are refused with no upstream call.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy, type Manifest } from '@shifa-spike/s4-generator';
import { stowBody } from '@shifa-spike/s4-stack';
import { orthanc, useStack } from '@shifa-spike/s4-stack/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { bearer, forgedTokens } from './tokens.ts';

const stack = useStack();
let cbct: { dir: string; manifest: Manifest };
let pano: { dir: string; manifest: Manifest };
const token = { uploaderA: '', uploaderB: '', viewerA: '', edgeA: '' };

async function stow(as: string, study: { dir: string; manifest: Manifest }, count = 5) {
  const files = await Promise.all(
    study.manifest.files.slice(0, count).map((f) => readFile(join(study.dir, f.path))),
  );
  const { body, contentType } = stowBody(files);
  return fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
    method: 'POST',
    body,
    headers: { ...bearer(as), 'content-type': contentType, accept: 'application/dicom+json' },
  });
}

const qido = async (as: string) => {
  const res = await fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
    headers: { ...bearer(as), accept: 'application/dicom+json' },
  });
  expect(res.status).toBe(200);
  const studies = (await res.json()) as { '0020000D': { Value: string[] } }[];
  return studies.map((s) => s['0020000D'].Value[0]);
};

const studiesIn = async (tenant: 'a' | 'b') => {
  const handle = stack.tenants[tenant];
  return (await (await orthanc(handle, '/studies?expand')).json()) as {
    MainDicomTags: { StudyInstanceUID: string };
  }[];
};

beforeAll(async () => {
  [cbct, pano] = [await ensureStudy('cbct-20-multi'), await ensureStudy('pano')];
  token.uploaderA = await stack.token({ sub: 'up-a', tenant: 'a', role: 'uploader' });
  token.uploaderB = await stack.token({ sub: 'up-b', tenant: 'b', role: 'uploader' });
  token.viewerA = await stack.token({ sub: 'viewer-a', tenant: 'a', role: 'viewer' });
  token.edgeA = await stack.token({ sub: 'edge-a', tenant: 'a', role: 'edge' });
});

describe('gateway tenant isolation', () => {
  it('keeps the same study stored by A and by B as two studies, one per Orthanc', async () => {
    expect((await stow(token.uploaderA, cbct)).status).toBe(200);
    expect((await stow(token.uploaderB, cbct)).status).toBe(200);
    expect((await stow(token.uploaderB, pano, 1)).status).toBe(200);
    const uid = cbct.manifest.studyInstanceUid;
    const inA = (await studiesIn('a')).map((s) => s.MainDicomTags.StudyInstanceUID);
    const inB = (await studiesIn('b')).map((s) => s.MainDicomTags.StudyInstanceUID);
    expect(inA).toEqual([uid]);
    expect(inB.sort()).toEqual([uid, pano.manifest.studyInstanceUid].sort());
  });

  it("gives A's viewer nothing of B's through QIDO-RS and WADO-RS", async () => {
    const viewer = token.viewerA;
    expect(await qido(viewer)).toEqual([cbct.manifest.studyInstanceUid]);
    const [file] = pano.manifest.files;
    if (!file) throw new Error('empty pano');
    const paths = (study: string, series: string, instance: string) => [
      `/dicomweb/studies/${study}/metadata`,
      `/dicomweb/studies/${study}/series`,
      `/dicomweb/studies/${study}/series/${series}/instances/${instance}`,
      `/dicomweb/studies/${study}/series/${series}/instances/${instance}/frames/1`,
    ];
    const ofB = paths(pano.manifest.studyInstanceUid, file.seriesInstanceUid, file.sopInstanceUid);
    const unknown = paths(
      '1.2.826.0.1.3680043.2.1',
      '1.2.826.0.1.3680043.2.2',
      '1.2.826.0.1.3680043.2.3',
    );
    for (let i = 0; i < ofB.length; i += 1) {
      const get = (path: string) =>
        fetch(`${stack.gatewayUrl}${path}`, { headers: bearer(viewer) });
      const [b, u] = [await get(ofB[i] ?? ''), await get(unknown[i] ?? '')];
      expect(b.status, ofB[i]).toBe(u.status);
      expect([404, 204]).toContain(b.status);
      expect(await b.text()).toBe(await u.text());
    }
  });

  it("lands A's STOW in A only", async () => {
    expect((await stow(token.uploaderA, pano, 1)).status).toBe(200);
    const inA = (await studiesIn('a')).map((s) => s.MainDicomTags.StudyInstanceUID);
    expect(inA.sort()).toEqual(
      [cbct.manifest.studyInstanceUid, pano.manifest.studyInstanceUid].sort(),
    );
    expect((await studiesIn('b')).length).toBe(2);
  });

  it('refuses bad tokens and wrong roles before any upstream call', async () => {
    const before = await stack.gateway.metrics();
    const forged = await forgedTokens(stack);
    const attempts: [string, Promise<Response>, number[]][] = [
      ['no token', fetch(`${stack.gatewayUrl}/dicomweb/studies`), [401]],
      ...Object.entries(forged).map(([name, t]): [string, Promise<Response>, number[]] => [
        name,
        fetch(`${stack.gatewayUrl}/dicomweb/studies`, { headers: bearer(t) }),
        [401, 403],
      ]),
      ['viewer STOW', stow(token.viewerA, pano, 1), [403]],
      [
        'edge QIDO',
        fetch(`${stack.gatewayUrl}/dicomweb/studies`, { headers: bearer(token.edgeA) }),
        [403],
      ],
    ];
    for (const [name, attempt, statuses] of attempts) {
      const res = await attempt;
      expect(statuses, name).toContain(res.status);
    }
    const after = await stack.gateway.metrics();
    expect(after.upstream).toBe(before.upstream);
    expect(after.audited).toBe(before.audited);
    expect(after.refused - before.refused).toBe(attempts.length);
  });
});
