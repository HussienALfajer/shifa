// Criterion 2 (IMG-04), the rules without Docker: the env allowlist (the image's startup-script
// hook needs no mount), entrypoint and command pinned to the image's, and mounted JSON that is
// unreadable or sets a scripting key. Complements licence-boundary.test.ts (running containers).
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IMAGES } from '../src/images.ts';
import { type InspectForLicence, licenceViolations } from '../src/orthanc.ts';

let dir = '';
let base: InspectForLicence;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 's4-licence-'));
  await writeFile(
    join(dir, 'ok.json'),
    JSON.stringify({ Name: 's4-a', DicomWeb: { Enable: true } }),
  );
  await writeFile(join(dir, 'master.key'), 'a2V5');
  base = {
    Mounts: [
      { Source: join(dir, 'ok.json'), Destination: '/etc/orthanc/s4.json', Type: 'bind' },
      {
        Source: join(dir, 'master.key'),
        Destination: '/etc/orthanc-keys/master.key',
        Type: 'bind',
      },
    ],
    Config: {
      Image: IMAGES.orthanc,
      Entrypoint: ['/docker-entrypoint.sh'],
      Cmd: ['/tmp/orthanc.json'],
      Env: [
        'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        'PYTHONUTF8=1',
        'LANG=C.UTF-8',
        'SSL_CERT_DIR=/etc/ssl/certs',
        'TRANSFERS_PLUGIN_ENABLED=true',
        'ORTHANC_EXPLORER_2_ENABLED=false',
        'VERBOSE_ENABLED=false',
        'VERBOSE_STARTUP=false',
      ],
    },
  };
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const withConfig = (patch: Partial<InspectForLicence['Config']>): InspectForLicence => ({
  ...base,
  Config: { ...base.Config, ...patch },
});
const withJson = (source: string): InspectForLicence => ({
  ...base,
  Mounts: [
    ...base.Mounts,
    { Source: source, Destination: '/etc/orthanc/extra.json', Type: 'bind' },
  ],
});

describe('licence rules', () => {
  it('accepts the harness configuration', () => {
    expect(licenceViolations(base)).toEqual([]);
  });

  it('refuses env outside the allowlist, a changed value, and the startup-script hook', () => {
    for (const entry of [
      'BEFORE_ORTHANC_STARTUP_SCRIPT=python3 -c "print(1)"',
      'VERBOSE_STARTUP=true',
      'DICOM_WEB_PLUGIN_ENABLED=true',
      'ORTHANC__REGISTERED_USERS={"x":"y"}',
    ]) {
      expect(
        licenceViolations(withConfig({ Env: [...base.Config.Env, entry] })),
        entry,
      ).not.toEqual([]);
    }
  });

  it('refuses an entrypoint or command override', () => {
    expect(licenceViolations(withConfig({ Entrypoint: ['/bin/sh'] }))).toContain('entrypoint');
    expect(licenceViolations(withConfig({ Cmd: ['/etc/orthanc/x.json'] }))).toContain('command');
  });

  it('refuses mounted JSON with scripting keys, unreadable or not JSON (fails closed)', async () => {
    await writeFile(join(dir, 'lua.json'), JSON.stringify({ LuaScripts: ['/x.lua'] }));
    await writeFile(join(dir, 'plugins.json'), JSON.stringify({ Plugins: ['/opt'] }));
    await writeFile(join(dir, 'script.json'), '#!/bin/sh\necho hi\n');
    for (const name of ['lua.json', 'plugins.json', 'script.json', 'missing.json']) {
      expect(licenceViolations(withJson(join(dir, name))), name).not.toEqual([]);
    }
  });
});
