// Daily usage (A-02 criteria 17, 19, 21; OD-116, PLT-16; slice A-02-07): a counter table per
// clinic and Damascus day that later specs add keys to. A-02 counts sign-ins, members signed in
// that day, active members and active branches, and keeps each clinic's last activity. The
// clinic page reads today's figures and 30 days; the clinics list reads the last activity and the
// sign-ins of the last seven days (`ClinicSummary`).
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { ClinicIdParams } from './platform.ts';

/** A Damascus calendar date, `YYYY-MM-DD`. */
const UsageDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const Count = z.int().min(0);

export const UsageTodayCounts = z
  .object({
    signIns: Count,
    /** Each member once, however often they signed in. */
    membersSignedIn: Count,
    /** Members who accepted and are not deactivated, now. */
    activeMembers: Count,
    /** Non-archived branches, now. */
    activeBranches: Count,
  })
  .meta({ id: 'UsageTodayCounts' });

export const UsageDay = z
  .object({ date: UsageDate, signIns: Count, membersSignedIn: Count })
  .meta({ id: 'UsageDay' });
export type UsageDay = z.infer<typeof UsageDay>;

export const UsageTotals = z
  .object({ signIns: Count, membersSignedIn: Count })
  .meta({ id: 'UsageTotals' });

export const ClinicUsage = z
  .object({
    /** Today's Damascus date (the last of `days`). */
    today: UsageDate,
    /** False while the clinic has no counter row at all (EmptyState «لا بيانات استخدام بعد»). */
    hasData: z.boolean(),
    todayCounts: UsageTodayCounts,
    /** Non-deactivated members (pending included): «من 26 عضوًا غير معطّل». */
    members: Count,
    /** Non-archived branches. */
    branches: Count,
    lastActivityAt: z.iso.datetime().nullable(),
    /** Exactly 30 days, oldest first, today last, zero-filled. */
    days: z.array(UsageDay),
    /** The totals of the 30 days before `days` (no Badge when 0). */
    previousTotals: UsageTotals,
  })
  .meta({ id: 'ClinicUsage' });
export type ClinicUsage = z.infer<typeof ClinicUsage>;

export const platformClinicUsage = defineContract({
  operationId: 'platformClinicUsage',
  method: 'GET',
  path: '/platform/clinics/:id/usage',
  summary: 'A clinic’s usage: today, its members and branches, and 30 Damascus days',
  request: { params: ClinicIdParams },
  responses: { 200: ClinicUsage, 404: ErrorEnvelope },
});
