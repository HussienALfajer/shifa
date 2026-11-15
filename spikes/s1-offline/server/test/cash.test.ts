// Criteria 2c and 3 (BIL-25, OD-29): append-only cash; offline only sales and refunds at a rate
// of the session; everything else refused offline with an Arabic message.
import { randomUUID } from 'node:crypto';
import { rawAppDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Command } from '../src/commands.ts';
import { cmd, rowsOf, useServer } from './helpers.ts';

const server = useServer();
const session = randomUUID();
let token = '';
const movementId = (c: Command) => (c.type === 'cash.move' ? c.payload.movementId : '');
const arabic = /[؀-ۿ]/;

beforeAll(async () => {
  token = await server.login();
  const res = await server.post(token, [cmd.open(session)]);
  expect(res.results[0]?.status).toBe('applied');
});

describe('offline cash', () => {
  it('accepts offline sales and a refund within the sale', async () => {
    const sale = cmd.move(session, 'sale', 'SYP', 500_000n);
    const refund = cmd.move(session, 'refund', 'SYP', 200_000n, { refundOf: movementId(sale) });
    const res = await server.post(token, [sale, refund]);
    expect(res.results.map((r) => r.status)).toEqual(['applied', 'applied']);
    const rows = await rowsOf<{ offline: boolean; rate_used: string }>(
      server.ids.A.tenantId,
      sql`select offline, rate_used::text from s1.cash_movement where id = ${movementId(sale)}`,
    );
    expect(rows[0]).toEqual({ offline: true, rate_used: '11000' });
  });

  it('refuses a refund above its sale minus earlier refunds', async () => {
    const sale = cmd.move(session, 'sale', 'USD', 10_000n);
    const first = cmd.move(session, 'refund', 'USD', 6_000n, { refundOf: movementId(sale) });
    const second = cmd.move(session, 'refund', 'USD', 5_000n, { refundOf: movementId(sale) });
    const res = await server.post(token, [sale, first, second]);
    expect(res.results.map((r) => r.status)).toEqual(['applied', 'applied', 'refused']);
    expect(res.results[2]?.conflict?.messageAr).toMatch(arabic);
  });

  it('refuses a refund in another currency than its sale', async () => {
    const sale = cmd.move(session, 'sale', 'TRY', 10_000n);
    const refund = cmd.move(session, 'refund', 'USD', 100n, { refundOf: movementId(sale) });
    const res = await server.post(token, [sale, refund]);
    expect(res.results[1]?.status).toBe('refused');
  });

  it.each(['expense', 'deposit', 'float_adjust'] as const)(
    'refuses an offline %s',
    async (type) => {
      const res = await server.post(token, [cmd.move(session, type, 'SYP', 1_000n)]);
      expect(res.results[0]?.status).toBe('refused');
      expect(res.results[0]?.conflict?.code).toBe('offline_cash_type');
      expect(res.results[0]?.conflict?.messageAr).toMatch(arabic);
    },
  );

  it('accepts an online expense', async () => {
    const res = await server.post(token, [
      cmd.move(session, 'expense', 'SYP', 1_000n, { offline: false }),
    ]);
    expect(res.results[0]?.status).toBe('applied');
  });

  it('refuses an offline sale at a rate the session never had', async () => {
    const res = await server.post(token, [cmd.move(session, 'sale', 'TRY', 100n, { rate: '45' })]);
    expect(res.results[0]?.status).toBe('refused');
    expect(res.results[0]?.conflict?.code).toBe('offline_rate');
  });

  it('refuses opening or closing a session offline', async () => {
    const res = await server.post(token, [cmd.open(randomUUID(), true), cmd.close(session, true)]);
    expect(res.results.map((r) => r.status)).toEqual(['refused', 'refused']);
    for (const r of res.results) expect(r.conflict?.messageAr).toMatch(arabic);
  });

  it('refuses a movement into a closed or unknown session', async () => {
    const other = randomUUID();
    await server.post(token, [cmd.open(other), cmd.close(other, false)]);
    const res = await server.post(token, [
      cmd.move(other, 'sale', 'SYP', 1_000n),
      cmd.move(randomUUID(), 'sale', 'SYP', 1_000n),
    ]);
    expect(res.results.map((r) => r.status)).toEqual(['refused', 'refused']);
  });

  it('keeps movements append-only for shifa_app', async () => {
    const tenant = server.ids.A.tenantId;
    const attempt = (statement: ReturnType<typeof sql>) =>
      rawAppDb().transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${tenant}, true)`);
        await tx.execute(statement);
      });
    // Drizzle's transaction wraps the driver error; the SQLSTATE is on its cause.
    const denied = { cause: { code: '42501' } };
    await expect(attempt(sql`update s1.cash_movement set amount_minor = 1`)).rejects.toMatchObject(
      denied,
    );
    await expect(attempt(sql`delete from s1.cash_movement`)).rejects.toMatchObject(denied);
  });

  it('has per-currency totals equal to the sum of applied commands', async () => {
    const s = randomUUID();
    await server.post(token, [cmd.open(s)]);
    const sale1 = cmd.move(s, 'sale', 'SYP', 300_000n);
    const batch = [
      sale1,
      cmd.move(s, 'sale', 'TRY', 5_000n),
      cmd.move(s, 'sale', 'USD', 2_500n),
      cmd.move(s, 'refund', 'SYP', 100_000n, { refundOf: movementId(sale1) }),
    ];
    await server.post(token, batch);
    const totals = await rowsOf<{ currency: string; total: string }>(
      server.ids.A.tenantId,
      sql`select currency, sum(case when type = 'sale' then amount_minor else -amount_minor end)::text
                 as total from s1.cash_movement where session_id = ${s} group by currency order by currency`,
    );
    expect(totals).toEqual([
      { currency: 'SYP', total: '200000' },
      { currency: 'TRY', total: '5000' },
      { currency: 'USD', total: '2500' },
    ]);
  });
});
