// Criterion 1: WAHA sits on the internal `messaging` network with no published port, answers
// only with the API key, keeps its state in its own PostgreSQL namespace and role, and never
// reaches the spike's own database. No session is ever started (OD-45).
import { describe, expect, it } from 'vitest';
import { inspectPorts } from '../src/containers.ts';
import { useStack } from './use-stack.ts';

describe('WAHA boundary', () => {
  const stack = useStack({ waha: ['platform', 'clinics'] });

  it('publishes no port', async () => {
    for (const waha of Object.values(stack.waha)) {
      expect(await inspectPorts(waha.container)).toEqual([]);
    }
  });

  it('cannot be reached from the edge network', async () => {
    const waha = stack.waha.clinics;
    const res = await stack.probe('edge', `${waha.url}/ping`, {});
    expect(res.status).toBe(0);
  });

  it('refuses API calls without the key and with another container key', async () => {
    const { clinics, platform } = stack.waha;
    expect((await stack.probe('messaging', `${clinics.url}/api/sessions`, {})).status).toBe(401);
    const other = await stack.probe('messaging', `${clinics.url}/api/sessions`, {
      apiKey: platform.apiKey,
    });
    expect(other.status).toBe(401);
    const own = await stack.probe('messaging', `${clinics.url}/api/sessions`, {
      apiKey: clinics.apiKey,
    });
    expect(own.status).toBe(200);
  });

  it("keeps each container's state in its own database, owned by its own role", async () => {
    const rows = await stack.wahaDb(
      "select datname, pg_get_userbyid(datdba) from pg_database where datname like 'waha%'",
    );
    for (const waha of Object.values(stack.waha)) {
      expect(rows).toContainEqual([`waha_${waha.namespace}`, waha.dbRole]);
    }
  });

  it("does not let WAHA's role reach the spike database", async () => {
    for (const waha of Object.values(stack.waha)) {
      const result = await stack.connectAs('messaging', waha.dbRole, waha.dbPassword);
      expect(result.ok, waha.name).toBe(false);
    }
  });

  it('stores a session created without start (no connection to WhatsApp is possible here)', async () => {
    const waha = stack.waha.clinics;
    const created = await stack.probe('messaging', `${waha.url}/api/sessions`, {
      apiKey: waha.apiKey,
      method: 'POST',
      json: { name: 'boundary-probe', start: false },
    });
    expect(created.status).toBeLessThan(300);
    const status = await stack.probe('messaging', `${waha.url}/api/sessions/boundary-probe`, {
      apiKey: waha.apiKey,
    });
    expect((JSON.parse(status.body) as { status: string }).status).toBe('STOPPED');
  });

  it('keeps API keys, HMAC keys and generated passwords out of the container logs', async () => {
    for (const waha of Object.values(stack.waha)) {
      const logs = await stack.logs(waha.container);
      for (const secret of [waha.apiKey, waha.hmacKey, waha.dbPassword]) {
        expect(logs.includes(secret), waha.name).toBe(false);
      }
      expect(logs).not.toMatch(/PASSWORD=/);
    }
  });
});
