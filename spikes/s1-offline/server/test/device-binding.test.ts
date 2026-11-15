// Review fixes: a token bound to a device sends only that device's commands (so nobody can plant
// results in another device's stream), and a malformed command is refused instead of failing
// the whole batch forever.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, rowsOf, useServer } from './helpers.ts';

const server = useServer();

async function deviceToken(deviceId: string): Promise<string> {
  const res = await server.app.inject({
    method: 'POST',
    url: '/auth/login',
    body: { username: server.ids.A.receptionist.username, deviceId },
  });
  return res.json<{ token: string }>().token;
}

describe('device binding', () => {
  it('refuses a command naming another device and stores nothing for it', async () => {
    const token = await deviceToken('dev-mine');
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const mine = cmd.issue('dev-mine', practitioner, 1);
    const theirs = cmd.issue('dev-victim', practitioner, 2);
    const res = await server.post(token, [mine, theirs]);
    expect(res.results.map((r) => r.status)).toEqual(['applied', 'refused']);
    expect(res.results[1]?.conflict?.code).toBe('forbidden');
    const stored = await rowsOf<{ n: number }>(
      server.ids.A.tenantId,
      sql`select count(*)::int as n from s1.offline_command where device_id = 'dev-victim'`,
    );
    expect(stored[0]?.n).toBe(0);
  });

  it('refuses out-of-range values by id and still applies the rest of the batch', async () => {
    const token = await server.login();
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const huge = cmd.issue('dev-1', practitioner, 1);
    if (huge.type !== 'ticket.issue') throw new Error('unexpected command');
    const tooBig = { ...huge, payload: { ...huge.payload, provisionalNumber: 3_000_000_000 } };
    const ancient = { ...cmd.issue('dev-1', practitioner, 2), clientTime: '0000-01-01T00:00:00Z' };
    const fine = cmd.issue('dev-1', practitioner, 3);
    const res = await server.post(token, [tooBig, ancient, fine]);
    expect(res.status).toBe(200);
    expect(res.results.map((r) => r.status)).toEqual(['refused', 'refused', 'applied']);
  });
});
