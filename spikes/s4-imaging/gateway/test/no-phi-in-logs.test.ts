// Privacy: after storing, searching and reading synthetic studies through the gateway, no
// container log (gateway, every Orthanc, PostgreSQL, Garage, the link) holds the synthetic name
// marker, a token or any per-run secret (passwords, Garage keys and tokens, storage master keys,
// the token key). The logs that must say something are checked to be non-empty, so a scan of an
// empty or unreadable log cannot pass by accident.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy, SYNTHETIC_MARKER } from '@shifa-spike/s4-generator';
import { stowBody } from '@shifa-spike/s4-stack';
import { useStack } from '@shifa-spike/s4-stack/testing';
import { describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';

const stack = useStack();

describe('no PHI, tokens or keys in logs', () => {
  it('keeps every container log free of the marker, tokens and secrets', async () => {
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
    for (const path of [
      '/dicomweb/studies?PatientName=*',
      `/dicomweb/studies?PatientName=${SYNTHETIC_MARKER}^*`,
      `/dicomweb/studies/${study}/metadata`,
    ]) {
      const res = await fetch(`${stack.gatewayUrl}${path}`, { headers: bearer(viewer) });
      expect(res.status, path).toBe(200);
      expect(await res.text()).toContain(SYNTHETIC_MARKER);
    }
    // A refused request with a token, so a careless error log would show it.
    await fetch(`${stack.gatewayUrl}/system`, { headers: bearer(viewer) });

    const secrets = stack.secrets();
    expect(secrets.length).toBeGreaterThanOrEqual(14);
    expect(secrets.every((s) => s.length >= 16)).toBe(true);
    const mustLog = [
      stack.gateway.container,
      stack.postgres.container,
      stack.garage.container,
      ...Object.values(stack.tenants).map((t) => t.container),
    ];
    for (const container of [...mustLog, stack.link.container]) {
      const logs = await stack.logs(container);
      if (mustLog.includes(container))
        expect(logs.length, `${container}: empty`).toBeGreaterThan(0);
      expect(logs.includes(SYNTHETIC_MARKER), `${container}: marker`).toBe(false);
      expect(logs.includes('eyJ'), `${container}: token`).toBe(false);
      expect(secrets.filter((secret) => logs.includes(secret)).length, `${container}: secret`).toBe(
        0,
      );
    }
  });
});
