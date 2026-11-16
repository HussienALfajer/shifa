// Privacy: after storing and reading synthetic studies through the gateway, no container log
// (gateway, every Orthanc, the link) holds the synthetic name marker, a token or key material.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy, SYNTHETIC_MARKER } from '@shifa-spike/s4-generator';
import { stowBody } from '@shifa-spike/s4-stack';
import { useStack } from '@shifa-spike/s4-stack/testing';
import { describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';

const stack = useStack();

describe('no PHI, tokens or keys in logs', () => {
  it('keeps the gateway and Orthanc logs free of the marker, tokens and secrets', async () => {
    const { dir, manifest } = await ensureStudy('cbct-20-multi');
    const uploader = await stack.token({ tenant: 'a', role: 'uploader' });
    const viewer = await stack.token({ tenant: 'a', role: 'viewer' });
    const files = await Promise.all(
      manifest.files.slice(0, 3).map((f) => readFile(join(dir, f.path))),
    );
    const { body, contentType } = stowBody(files);
    const stored = await fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
      method: 'POST',
      body,
      headers: { ...bearer(uploader), 'content-type': contentType },
    });
    expect(stored.status).toBe(200);
    const study = manifest.studyInstanceUid;
    for (const path of ['/dicomweb/studies?PatientName=*', `/dicomweb/studies/${study}/metadata`]) {
      const res = await fetch(`${stack.gatewayUrl}${path}`, { headers: bearer(viewer) });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(SYNTHETIC_MARKER);
    }
    // A refused request with a token, so a careless error log would show it.
    await fetch(`${stack.gatewayUrl}/system`, { headers: bearer(viewer) });

    const secrets = [
      ...Object.values(stack.tenants).flatMap((t) => [
        t.s3.secretAccessKey,
        t.orthancAuth.slice(6),
      ]),
      Buffer.from(stack.tokenKey).toString('base64'),
      Buffer.from(stack.tokenKey).toString('hex'),
    ];
    const containers = [
      stack.gateway.container,
      stack.link.container,
      ...Object.values(stack.tenants).map((t) => t.container),
    ];
    for (const container of containers) {
      const logs = await stack.logs(container);
      expect(logs.includes(SYNTHETIC_MARKER), `${container}: marker`).toBe(false);
      expect(logs.includes('eyJ'), `${container}: token`).toBe(false);
      for (const secret of secrets)
        expect(logs.includes(secret), `${container}: secret`).toBe(false);
    }
  });
});
