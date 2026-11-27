// Writing the daily counters in the clinic's own transaction (A-02 criterion 17; shifa_app inside
// withTenant(), RLS keeps every row to the clinic). Called by identity (sign-in, a request's
// activity, an accepted invitation), team (a member deactivated or reactivated) and branches (a
// branch added, archived or restored). Upserts only: a counter is never deleted.
import { clinicActiveCounts, membership, type Tx, usageDaily } from '@shifa/db';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { damascusDay } from './day.ts';

/** The keys A-02 counts; later specs add theirs here (OD-116). */
export const USAGE_KEYS = [
  'sign_ins',
  'members_signed_in',
  'active_members',
  'active_branches',
] as const;
export type UsageKey = (typeof USAGE_KEYS)[number];

/** The clinic's latest request, as minutes since the epoch (kept with greatest()). */
export const LAST_ACTIVITY_KEY = 'last_activity_minute';

type Key = UsageKey | typeof LAST_ACTIVITY_KEY;
type Merge = 'add' | 'set' | 'max';

async function write(tx: Tx, at: Date, key: Key, value: number, merge: Merge): Promise<void> {
  const next =
    merge === 'add'
      ? sql`${usageDaily.value} + excluded.value`
      : merge === 'max'
        ? sql`greatest(${usageDaily.value}, excluded.value)`
        : sql`excluded.value`;
  await tx
    .insert(usageDaily)
    .values({ tenantId: sql`current_tenant_id()`, day: damascusDay(at), key, value, updatedAt: at })
    .onConflictDoUpdate({
      target: [usageDaily.tenantId, usageDaily.day, usageDaily.key],
      set: { value: next, updatedAt: at },
    });
}

/** The clinic was used at `at`: its last activity moves forward, never back. */
export async function recordActivity(tx: Tx, at: Date): Promise<void> {
  await write(tx, at, LAST_ACTIVITY_KEY, Math.floor(at.getTime() / 60_000), 'max');
}

/** The day's active members and active branches, as they are now. */
export async function recordGauges(tx: Tx, at: Date): Promise<void> {
  const counts = await clinicActiveCounts(tx);
  await write(tx, at, 'active_members', counts.activeMembers, 'set');
  await write(tx, at, 'active_branches', counts.activeBranches, 'set');
}

/**
 * A sign-in of `userId` in this clinic at `at`: one more sign-in, one more member signed in when it
 * is their first of the Damascus day (the day is kept on their membership only, no list of
 * people), the day's gauges and the last activity.
 */
export async function recordSignIn(tx: Tx, at: Date, userId: string): Promise<void> {
  const day = damascusDay(at);
  const first = await tx
    .update(membership)
    .set({ lastSignInOn: day })
    .where(
      and(
        eq(membership.userId, userId),
        eq(membership.status, 'active'),
        or(isNull(membership.lastSignInOn), ne(membership.lastSignInOn, day)),
      ),
    )
    .returning({ id: membership.id });
  await write(tx, at, 'sign_ins', 1, 'add');
  if (first.length > 0) await write(tx, at, 'members_signed_in', 1, 'add');
  await recordGauges(tx, at);
  await recordActivity(tx, at);
}
