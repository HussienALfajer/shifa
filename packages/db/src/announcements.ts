// Counts across clinics for the super admin's announcements and usage (A-02 criteria 17, 22;
// ADR-0051). announcement_counts() and clinic_member_counts() (SECURITY DEFINER) read each clinic
// under its own tenant policies and return integers only; these helpers map them back to the ids
// the platform already holds. Every clinic is passed from `tenant` in the same statement.
import { sql } from 'drizzle-orm';
import { assertUuid } from './context.ts';
import type { PlatformTx } from './platform.ts';
import type { Tx } from './transaction.ts';

export interface AnnouncementCounts {
  /** Non-deactivated members of the announcement's clinics (pending included). */
  targeted: number;
  /** Those of them (with an account) who hid its current version. */
  dismissed: number;
}

export interface AnnouncementCountInput {
  id: string;
  version: number;
  /** Aimed at every clinic (otherwise at its target rows). */
  all: boolean;
}

/** The counts of each announcement, by id; runs in an announcement action only. */
export async function announcementCounts(
  tx: PlatformTx,
  items: readonly AnnouncementCountInput[],
): Promise<Map<string, AnnouncementCounts>> {
  const out = new Map<string, AnnouncementCounts>();
  if (items.length === 0) return out;
  for (const item of items) {
    assertUuid('announcementId', item.id);
    if (!Number.isInteger(item.version) || item.version < 1) {
      throw new RangeError('an announcement version is a positive integer');
    }
  }
  const ids = `{${items.map((i) => i.id).join(',')}}`;
  const versions = `{${items.map((i) => String(i.version)).join(',')}}`;
  const all = `{${items.map((i) => (i.all ? 't' : 'f')).join(',')}}`;
  const { rows } = await tx.execute<{ ord: number; targeted: number; dismissed: number }>(
    sql`select ord, targeted, dismissed
          from announcement_counts(${ids}::uuid[], ${versions}::integer[], ${all}::boolean[],
                                   array(select id from tenant))`,
  );
  for (const row of rows) {
    const item = items[row.ord - 1];
    if (item === undefined) continue;
    out.set(item.id, { targeted: row.targeted, dismissed: row.dismissed });
  }
  return out;
}

export interface ClinicMemberCounts {
  /** Non-deactivated members (pending included). */
  members: number;
  /** Members who accepted and are not deactivated. */
  activeMembers: number;
  /** Non-archived branches. */
  branches: number;
}

/** A clinic's member and branch counts, as integers only; runs in clinic.usage_viewed only. */
export async function clinicMemberCounts(
  tx: PlatformTx,
  tenantId: string,
): Promise<ClinicMemberCounts> {
  assertUuid('tenantId', tenantId);
  const { rows } = await tx.execute<{
    members: number;
    active_members: number;
    branches: number;
  }>(sql`select members, active_members, branches from clinic_member_counts(${tenantId}::uuid)`);
  const row = rows[0];
  return {
    members: row?.members ?? 0,
    activeMembers: row?.active_members ?? 0,
    branches: row?.branches ?? 0,
  };
}

/**
 * The same members and branches in the clinic's own context (shifa_app inside withTenant()): the
 * day's `active_members` and `active_branches` counters. RLS keeps it to the clinic.
 */
export async function clinicActiveCounts(
  tx: Tx,
): Promise<{ activeMembers: number; activeBranches: number }> {
  const { rows } = await tx.execute<{ active_members: number; active_branches: number }>(sql`
    select
      (select count(*)::integer from membership m
        where m.tenant_id = current_tenant_id() and m.status = 'active') as active_members,
      (select count(*)::integer from branch b
        where b.tenant_id = current_tenant_id() and b.archived_at is null) as active_branches`);
  const row = rows[0];
  return { activeMembers: row?.active_members ?? 0, activeBranches: row?.active_branches ?? 0 };
}
