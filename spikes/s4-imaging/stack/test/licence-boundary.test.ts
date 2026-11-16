// Criterion 2 (IMG-04): nothing but Orthanc configuration JSON and the storage master-key files
// is mounted into an Orthanc container; no script, no extra plugin, no scripting environment.
// The negative cases prove the check fails when a Lua script or scripting env is added.
import { describe, expect, it } from 'vitest';
import { dockerJson } from '../src/docker.ts';
import { type InspectForLicence, licenceViolations } from '../src/orthanc.ts';
import { useStack } from './use-stack.ts';

const stack = useStack();

const inspect = async (container: string): Promise<InspectForLicence> => {
  const [data] = await dockerJson<InspectForLicence[]>(['inspect', container]);
  if (!data) throw new Error(`no inspect data for ${container}`);
  return data;
};

describe('licence boundary', () => {
  it('holds for every running Orthanc', async () => {
    for (const tenant of Object.values(stack.tenants)) {
      const data = await inspect(tenant.container);
      expect(data.Mounts.length, tenant.id).toBeGreaterThan(0);
      expect(licenceViolations(data), tenant.id).toEqual([]);
    }
  });

  it('fails on a mounted extra.lua, a plugin, a Python script or scripting env', async () => {
    const tenant = Object.values(stack.tenants)[0];
    if (!tenant) throw new Error('no tenant');
    const base = await inspect(tenant.container);
    const withMount = (source: string, destination: string): InspectForLicence => ({
      ...base,
      Mounts: [...base.Mounts, { Source: source, Destination: destination, Type: 'bind' }],
    });
    const withEnv = (entry: string): InspectForLicence => ({
      ...base,
      Config: { ...base.Config, Env: [...base.Config.Env, entry] },
    });
    const cases = [
      withMount('/tmp/extra.lua', '/etc/orthanc/extra.lua'),
      withMount('/tmp/hook.py', '/etc/orthanc/hook.py'),
      withMount('/tmp/libExtra.so', '/usr/share/orthanc/plugins/libExtra.so'),
      withMount('/tmp/plugins', '/usr/share/orthanc/plugins-extra'),
      withEnv('ORTHANC__PYTHON_SCRIPT=/etc/orthanc/hook.py'),
      withEnv('PYTHON_PLUGIN_ENABLED=true'),
      withEnv('LUA_SCRIPTS=["/etc/orthanc/extra.lua"]'),
      withEnv('ORTHANC__LUA_SCRIPTS=["/etc/orthanc/extra.lua"]'),
      withEnv('ORTHANC__PLUGINS=["/opt/extra"]'),
    ];
    for (const data of cases) expect(licenceViolations(data).length).toBeGreaterThan(0);
  });
});
