// Criterion 1, SCH-13: a replayed idempotency key returns the stored result and writes nothing.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, rowsOf, useServer } from './helpers.ts';

const server = useServer();
const practitioner = () => server.ids.A.practitioners[0]?.id ?? '';
const countTickets = async () =>
  (
    await rowsOf<{ n: number }>(
      server.ids.A.tenantId,
      sql`select count(*)::int as n from s1.queue_ticket`,
    )
  )[0]?.n;

describe('idempotency', () => {
  it('returns the stored result when the same command is sent twice', async () => {
    const token = await server.login();
    const issue = cmd.issue('dev-1', practitioner(), 1);
    const first = await server.post(token, [issue]);
    const before = await countTickets();
    const second = await server.post(token, [issue]);
    expect(first.status).toBe(200);
    expect(first.results[0]?.status).toBe('applied');
    expect(second.results).toEqual(first.results);
    expect(await countTickets()).toBe(before);
  });

  it('replays a whole batch with identical results and no new rows', async () => {
    const token = await server.login();
    const batch = [1, 2, 3].map((n) => cmd.issue('dev-2', practitioner(), n));
    const first = await server.post(token, batch);
    const before = await countTickets();
    const second = await server.post(token, batch);
    expect(second.results).toEqual(first.results);
    expect(first.results.map((r) => r.id)).toEqual(batch.map((c) => c.id));
    expect(await countTickets()).toBe(before);
  });

  it('applies one of two concurrent posts of the same id', async () => {
    const token = await server.login();
    const issue = cmd.issue('dev-3', practitioner(), 1);
    const before = (await countTickets()) ?? 0;
    const [a, b] = await Promise.all([server.post(token, [issue]), server.post(token, [issue])]);
    expect(a.results).toEqual(b.results);
    expect(await countTickets()).toBe(before + 1);
    const stored = await rowsOf<{ n: number }>(
      server.ids.A.tenantId,
      sql`select count(*)::int as n from s1.offline_command where id = ${issue.id}`,
    );
    expect(stored[0]?.n).toBe(1);
  });

  it('refuses a malformed command by id and still applies the rest of the batch', async () => {
    const token = await server.login();
    const good = cmd.issue('dev-4', practitioner(), 1);
    const bad = { ...cmd.issue('dev-4', practitioner(), 2), type: 'ticket.unknown' };
    const res = await server.post(token, [bad, good]);
    expect(res.results.map((r) => r.status)).toEqual(['refused', 'applied']);
    expect(res.results[0]?.id).toBe(bad.id);
  });

  it('rejects a batch over 200 commands', async () => {
    const token = await server.login();
    const batch = Array.from({ length: 201 }, (_, i) => cmd.issue('dev-5', practitioner(), i + 1));
    expect((await server.post(token, batch)).status).toBe(400);
  });
});
