// Synthetic insert helpers for A-01 tables (tests only; A-01-01). People and phones come from
// @shifa/testing's generator (docs/compliance/data-handling.md §1); ids are derived from a
// label so tests can name rows without RETURNING (which needs SELECT the writer may not have).
import { createHash } from 'node:crypto';
import { createRandom, PhoneRegistry } from '@shifa/testing';
import type { PlatformTx } from '../src/platform.ts';
import {
  branch,
  membership,
  setupLink,
  type TenantType,
  tenant,
  user,
} from '../src/schema/index.ts';
import type { Tx } from '../src/transaction.ts';

/** A stable UUID (version 4 layout) for `label`: the same label always gives the same id. */
export function fixtureId(label: string): string {
  const h = createHash('sha256').update(`shifa-fixture:${label}`).digest('hex');
  const variant = ((Number.parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** `count` distinct synthetic Syrian mobile numbers (E.164) for `seed`. */
export function syntheticPhones(seed: number, count: number): string[] {
  const random = createRandom(seed);
  const registry = new PhoneRegistry();
  return Array.from({ length: count }, () => registry.next(random, 'SY'));
}

/** A tenant row on the platform path (global parent of every tenant row). */
export async function insertTenantRow(
  tx: PlatformTx,
  row: { id: string; name?: string; type?: TenantType },
): Promise<void> {
  await tx
    .insert(tenant)
    .values({ id: row.id, name: row.name ?? 'عيادة تجريبية', type: row.type ?? 'multi_doctor' });
}

/** A person on the auth path (shifa_auth). */
export async function insertUser(
  tx: Tx,
  row: { id: string; phone: string | undefined; name?: string },
): Promise<void> {
  if (row.phone === undefined) throw new Error('insertUser() needs a phone');
  await tx.insert(user).values({
    id: row.id,
    name: row.name ?? 'شخص تجريبي',
    // Better Auth requires a unique email; phone sign-in fills a placeholder (A-01-02).
    email: `${row.id}@example.invalid`,
    phoneNumber: row.phone,
  });
}

/** A branch inside a tenant (withTenant()). */
export async function insertBranch(
  tx: Tx,
  row: { id: string; tenantId: string; name?: string },
): Promise<void> {
  await tx
    .insert(branch)
    .values({ id: row.id, tenantId: row.tenantId, name: row.name ?? 'فرع تجريبي' });
}

/** A member inside a tenant (withTenant()); pending until `userId` is given. */
export async function insertMembership(
  tx: Tx,
  row: { id: string; tenantId: string; phone: string; userId?: string | null },
): Promise<void> {
  await tx.insert(membership).values({
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId ?? null,
    phoneE164: row.phone,
    displayName: 'موظف تجريبي',
    status: row.userId ? 'active' : 'pending',
  });
}

/** A setup link inside a tenant (withTenant()), valid until 2030. */
export async function insertSetupLink(
  tx: Tx,
  row: { id: string; tenantId: string; membershipId: string; tokenHashHex: string },
): Promise<void> {
  await tx.insert(setupLink).values({
    id: row.id,
    tenantId: row.tenantId,
    membershipId: row.membershipId,
    purpose: 'member_setup',
    tokenHash: row.tokenHashHex,
    expiresAt: new Date('2030-01-01T00:00:00Z'),
  });
}
