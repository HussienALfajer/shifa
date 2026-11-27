// A-02 criterion 17 (A-02-07): the usage day is the Damascus day, and the counters move at its
// midnight, not UTC's. Exercised on the clinic's own transaction with a fake time: sign-ins count
// each time, members signed in once per person per day (the day is kept on the membership only,
// no list of people), and the last activity keeps the latest minute.
import { usageDaily } from '@shifa/db';
import { superuserDb, syntheticPhones, testDb, workerDatabaseName } from '@shifa/db/testing';
import { and, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  damascusDay,
  recordActivity,
  recordSignIn,
  USAGE_KEYS,
} from '../../src/modules/usage/index.ts';
import { resetWithTenants, seedPerson } from '../identity/support.ts';

const TENANT = '00000000-0000-4000-8000-00000000a701';
const OTHER = '00000000-0000-4000-8000-00000000a702';
let first: { userId: string };
let second: { userId: string };
let elsewhere: { userId: string };

beforeAll(async () => {
  await resetWithTenants(TENANT, OTHER);
  const phones = syntheticPhones(2026_12_11, 3);
  first = await seedPerson(phones[0] ?? '', { tenantId: TENANT, role: 'doctor' });
  second = await seedPerson(phones[1] ?? '', { tenantId: TENANT, role: 'receptionist' });
  elsewhere = await seedPerson(phones[2] ?? '', { tenantId: OTHER, role: 'owner' });
});

const signIn = (tenantId: string, userId: string, at: string) =>
  testDb().withTenant({ tenantId, userId }, (tx) => recordSignIn(tx, new Date(at), userId));
const touch = (tenantId: string, userId: string, at: string) =>
  testDb().withTenant({ tenantId, userId }, (tx) => recordActivity(tx, new Date(at)));

async function counts(tenantId: string, day: string): Promise<Record<string, number>> {
  const rows = await superuserDb(workerDatabaseName())
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.tenantId, tenantId), eq(usageDaily.day, day)));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

describe('damascusDay', () => {
  it('turns at Damascus midnight (UTC+3), not at UTC midnight', () => {
    expect(damascusDay(new Date('2026-12-01T20:59:59Z'))).toBe('2026-12-01');
    expect(damascusDay(new Date('2026-12-01T21:00:00Z'))).toBe('2026-12-02');
    expect(damascusDay(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02');
    expect(damascusDay(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
  });

  it('names the keys this spec counts', () => {
    expect(USAGE_KEYS).toEqual([
      'sign_ins',
      'members_signed_in',
      'active_members',
      'active_branches',
    ]);
  });
});

describe('counters on a fake clock', () => {
  it('counts a sign-in at 23:59 and one at 00:01 Damascus on two days', async () => {
    await signIn(TENANT, first.userId, '2026-12-01T20:59:00Z');
    await signIn(TENANT, first.userId, '2026-12-01T21:01:00Z');
    expect(await counts(TENANT, '2026-12-01')).toMatchObject({
      sign_ins: 1,
      members_signed_in: 1,
    });
    expect(await counts(TENANT, '2026-12-02')).toMatchObject({
      sign_ins: 1,
      members_signed_in: 1,
    });
  });

  it('counts every sign-in, and each member once a day', async () => {
    await signIn(TENANT, first.userId, '2026-12-02T08:00:00Z');
    await signIn(TENANT, second.userId, '2026-12-02T09:00:00Z');
    await signIn(TENANT, second.userId, '2026-12-02T10:00:00Z');
    expect(await counts(TENANT, '2026-12-02')).toMatchObject({
      sign_ins: 4,
      members_signed_in: 2,
    });
  });

  it('records the active members and branches of the day with each sign-in', async () => {
    expect(await counts(TENANT, '2026-12-02')).toMatchObject({
      active_members: 2,
      active_branches: 1,
    });
  });

  it('keeps each clinic apart', async () => {
    await signIn(OTHER, elsewhere.userId, '2026-12-02T09:30:00Z');
    expect(await counts(OTHER, '2026-12-02')).toMatchObject({
      sign_ins: 1,
      members_signed_in: 1,
    });
    expect((await counts(TENANT, '2026-12-02'))['sign_ins']).toBe(4);
  });

  it('keeps the latest minute of activity, an earlier one changes nothing', async () => {
    await touch(TENANT, first.userId, '2026-12-02T11:30:20Z');
    await touch(TENANT, first.userId, '2026-12-02T11:00:00Z');
    const minute = (await counts(TENANT, '2026-12-02'))['last_activity_minute'];
    expect(minute).toBe(Math.floor(Date.parse('2026-12-02T11:30:20Z') / 60_000));
  });

  it('keeps no list of who signed in, only each membership’s last day', async () => {
    const columns = await superuserDb(workerDatabaseName()).execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
            where table_schema = 'public' and table_name = 'usage_daily' order by 1`,
    );
    expect(columns.rows.map((r) => r.column_name)).toEqual([
      'day',
      'id',
      'key',
      'tenant_id',
      'updated_at',
      'value',
    ]);
  });
});
