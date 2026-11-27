// The super admin's view of usage (A-02 criteria 17, 19, 21; contract rows `use`, `useMembers`,
// `useLoading`, `useEmpty` and the clinics list with usage). Counters are read across clinics in
// clinic.listed and clinic.usage_viewed only (policies); members and branches come from
// clinic_member_counts() (integers only, ADR-0051): the platform role reads no member or branch.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ClinicUsage, UsageDay } from '@shifa/contracts';
import {
  clinicMemberCounts,
  type PlatformDb,
  type PlatformTx,
  tenant,
  usageDaily,
} from '@shifa/db';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { addDays, damascusDay } from './day.ts';
import { LAST_ACTIVITY_KEY } from './record.ts';
import { USAGE_PLATFORM_DB } from './tokens.ts';

const DAYS = 30;
const SERIES_KEYS = ['sign_ins', 'members_signed_in'] as const;

export interface ClinicActivity {
  lastActivityAt: string | null;
  signIns7d: number;
}

const NO_ACTIVITY: ClinicActivity = { lastActivityAt: null, signIns7d: 0 };

const minuteToIso = (minute: number | null): string | null =>
  minute === null ? null : new Date(minute * 60_000).toISOString();

/**
 * Every clinic's last activity and sign-ins of the last seven Damascus days (today included), by
 * clinic id, for the clinics list; runs inside its clinic.listed transaction.
 */
export async function clinicActivity(
  tx: PlatformTx,
  at: Date,
): Promise<{ of(id: string): ClinicActivity }> {
  const today = damascusDay(at);
  const from = addDays(today, -6);
  const { rows } = await tx.execute<{ tenant_id: string; sign_ins: number; minute: number | null }>(
    sql`select tenant_id,
               coalesce(sum(value) filter (where key = 'sign_ins' and day between ${from}::date
                                                                    and ${today}::date), 0)::integer
                 as sign_ins,
               max(value) filter (where key = ${LAST_ACTIVITY_KEY}) as minute
          from usage_daily
         where key in ('sign_ins', ${LAST_ACTIVITY_KEY})
         group by tenant_id`,
  );
  const byClinic = new Map(
    rows.map((r) => [
      r.tenant_id,
      { lastActivityAt: minuteToIso(r.minute), signIns7d: r.sign_ins },
    ]),
  );
  return { of: (id) => byClinic.get(id) ?? NO_ACTIVITY };
}

@Injectable()
export class UsageAdmin {
  constructor(
    @Inject(USAGE_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  clinicUsage(principal: Principal, rawId: string, requestId: string): Promise<ClinicUsage> {
    const id = rawId.toLowerCase();
    return this.platformDb.withPlatformAdmin(
      { actorId: principal.userId, event: 'clinic.usage_viewed', requestId, targetId: id },
      async (tx) => {
        const [clinic] = await tx.select({ id: tenant.id }).from(tenant).where(eq(tenant.id, id));
        if (!clinic) throw new NotFoundException();
        const today = damascusDay(this.clock.now());
        const first = addDays(today, -(DAYS - 1));
        const previousFirst = addDays(first, -DAYS);
        const rows = await tx
          .select({ day: usageDaily.day, key: usageDaily.key, value: usageDaily.value })
          .from(usageDaily)
          .where(
            and(
              eq(usageDaily.tenantId, id),
              gte(usageDaily.day, previousFirst),
              inArray(usageDaily.key, [...SERIES_KEYS]),
            ),
          );
        const { rows: meta } = await tx.execute<{ any_row: boolean; minute: number | null }>(
          sql`select exists (select 1 from usage_daily where tenant_id = ${id}) as any_row,
                     (select max(value) from usage_daily
                       where tenant_id = ${id} and key = ${LAST_ACTIVITY_KEY}) as minute`,
        );
        const counts = await clinicMemberCounts(tx, id);
        const value = (day: string, key: string) =>
          rows.find((r) => r.day === day && r.key === key)?.value ?? 0;
        const days: UsageDay[] = Array.from({ length: DAYS }, (_, i) => {
          const date = addDays(first, i);
          return {
            date,
            signIns: value(date, 'sign_ins'),
            membersSignedIn: value(date, 'members_signed_in'),
          };
        });
        const previous = rows.filter((r) => r.day >= previousFirst && r.day < first);
        const total = (key: string) =>
          previous.filter((r) => r.key === key).reduce((sum, r) => sum + r.value, 0);
        return {
          today,
          hasData: meta[0]?.any_row === true,
          todayCounts: {
            signIns: value(today, 'sign_ins'),
            membersSignedIn: value(today, 'members_signed_in'),
            activeMembers: counts.activeMembers,
            activeBranches: counts.branches,
          },
          members: counts.members,
          branches: counts.branches,
          lastActivityAt: minuteToIso(meta[0]?.minute ?? null),
          days,
          previousTotals: {
            signIns: total('sign_ins'),
            membersSignedIn: total('members_signed_in'),
          },
        };
      },
    );
  }
}
