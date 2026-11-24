// Creating a clinic (A-01a criterion 2): one tenant, one organization, one active main branch and
// a deployment route, and (A-01-03) its owner: a pending membership, the tenant-wide owner role
// and the owner's setup link, all inside the caller's platform transaction, so they commit
// together with the audit row of withPlatformAdmin(). Also the platform's two other writes:
// re-issuing an owner's link and registering a super admin (seed command).
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { assertTokenHash, assertUuid } from './context.ts';
import { auditTargetOf, type PlatformTx } from './platform.ts';
import {
  branch,
  deploymentRoute,
  membership,
  organization,
  platformAdmin,
  roleAssignment,
  setupLink,
  type TenantStatus,
  type TenantType,
  tenant,
} from './schema/index.ts';

/** The first branch of every clinic (PLT-03: a solo clinic sees no branch screens). */
export const MAIN_BRANCH_NAME = 'الفرع الرئيسي';

/** A setup link as stored: only the SHA-256 of its token (64 lower-case hex digits). */
export interface NewLink {
  purpose: 'owner_setup' | 'invitation';
  tokenHash: string;
  expiresAt: Date;
}

export interface NewOwner {
  displayName: string;
  /** E.164, normalised by the caller. */
  phoneE164: string;
  link: NewLink;
}

export interface NewClinic {
  /** Generated when absent; given when the caller needs it first (tests, idempotent retries). */
  tenantId?: string;
  name: string;
  type: TenantType;
  status?: TenantStatus;
  /** ISO date (YYYY-MM-DD); no automatic effect in A-01. */
  subscriptionEnd?: string | null;
  idleMinutes?: 15 | 30 | 60;
  /** Defaults to 'primary' (ADR-0004: every tenant on the shared database for now). */
  databaseKey?: string;
  /** The owner (A-01-03): a pending membership, the owner role and the setup link. */
  owner?: NewOwner;
}

export interface CreatedClinic {
  tenantId: string;
  organizationId: string;
  branchId: string;
  ownerMembershipId?: string;
}

/** Runs `fn` with `app.tenant_id` set in a savepoint, cleared again before it ends. */
async function inTenant<T>(tx: PlatformTx, tenantId: string, fn: (sp: PlatformTx) => Promise<T>) {
  // If anything throws, the setting is rolled back with the rows, so no later statement of the
  // platform transaction runs inside this tenant.
  return tx.transaction(async (sp) => {
    await sp.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    const result = await fn(sp as unknown as PlatformTx);
    await sp.execute(sql`select set_config('app.tenant_id', '', true)`);
    return result;
  });
}

/**
 * Inserts the clinic's rows on the platform path. The tenant rows are written under a tenant
 * context set for this transaction only (shifa_platform holds INSERT, not SELECT, on tenant
 * tables) and cleared again before returning. Constraint violations throw and roll back the
 * caller's transaction.
 */
export async function createClinic(tx: PlatformTx, input: NewClinic): Promise<CreatedClinic> {
  const tenantId = input.tenantId ?? randomUUID();
  assertUuid('tenantId', tenantId);
  if (input.owner) assertTokenHash(input.owner.link.tokenHash);
  const organizationId = randomUUID();
  const branchId = randomUUID();
  const ownerMembershipId = input.owner ? randomUUID() : undefined;
  await tx.insert(tenant).values({
    id: tenantId,
    name: input.name,
    type: input.type,
    status: input.status ?? 'trial',
    subscriptionEnd: input.subscriptionEnd ?? null,
    idleMinutes: input.idleMinutes ?? 30,
  });
  await inTenant(tx, tenantId, async (sp) => {
    await sp.insert(organization).values({ id: organizationId, tenantId, name: input.name });
    await sp.insert(branch).values({ id: branchId, tenantId, name: MAIN_BRANCH_NAME });
    await sp.insert(deploymentRoute).values({
      tenantId,
      databaseKey: input.databaseKey ?? 'primary',
    });
    const { owner } = input;
    if (owner && ownerMembershipId) {
      await sp.insert(membership).values({
        id: ownerMembershipId,
        tenantId,
        phoneE164: owner.phoneE164,
        displayName: owner.displayName,
        status: 'pending',
      });
      await sp
        .insert(roleAssignment)
        .values({ tenantId, membershipId: ownerMembershipId, role: 'owner', branchId: null });
      await sp.insert(setupLink).values({
        tenantId,
        membershipId: ownerMembershipId,
        purpose: owner.link.purpose,
        tokenHash: owner.link.tokenHash,
        expiresAt: owner.link.expiresAt,
        // An invitation also shows in the person's clinic chooser (A-01-05, OD-90).
        invitedPhone: owner.link.purpose === 'invitation' ? owner.phoneE164 : null,
      });
    }
  });
  // The withPlatformAdmin() audit row names the clinic it created (A-01a criterion 14).
  auditTargetOf(tx)?.setTarget(tenantId);
  return {
    tenantId,
    organizationId,
    branchId,
    ...(ownerMembershipId ? { ownerMembershipId } : {}),
  };
}

export interface OwnerLink extends NewLink {
  tenantId: string;
  membershipId: string;
}

/**
 * A new setup link for a clinic's owner (an owner.link_issued transaction): every earlier unused
 * link of that membership is marked replaced, so only the new one works (A-01a criterion 4).
 */
export async function issueOwnerLink(tx: PlatformTx, link: OwnerLink): Promise<void> {
  assertUuid('tenantId', link.tenantId);
  assertUuid('membershipId', link.membershipId);
  assertTokenHash(link.tokenHash);
  await inTenant(tx, link.tenantId, async (sp) => {
    await sp
      .update(setupLink)
      .set({ replacedAt: sql`now()` })
      .where(
        and(
          eq(setupLink.tenantId, link.tenantId),
          eq(setupLink.membershipId, link.membershipId),
          isNull(setupLink.usedAt),
          isNull(setupLink.replacedAt),
        ),
      );
    const [owner] =
      link.purpose === 'invitation'
        ? await sp
            .select({ phone: membership.phoneE164 })
            .from(membership)
            .where(eq(membership.id, link.membershipId))
        : [];
    await sp.insert(setupLink).values({
      tenantId: link.tenantId,
      membershipId: link.membershipId,
      purpose: link.purpose,
      tokenHash: link.tokenHash,
      expiresAt: link.expiresAt,
      invitedPhone: owner?.phone ?? null,
    });
  });
}

/**
 * Expiry of the owner's latest open link (unused, not replaced), past or future; null when none
 * is open (the owner card, A-01-11). Only `expires_at` is read, never a token hash.
 */
export async function ownerLinkExpiry(
  tx: PlatformTx,
  owner: { tenantId: string; membershipId: string },
): Promise<Date | null> {
  assertUuid('tenantId', owner.tenantId);
  assertUuid('membershipId', owner.membershipId);
  const [open] = await inTenant(tx, owner.tenantId, (sp) =>
    sp
      .select({ expiresAt: setupLink.expiresAt })
      .from(setupLink)
      .where(
        and(
          eq(setupLink.tenantId, owner.tenantId),
          eq(setupLink.membershipId, owner.membershipId),
          isNull(setupLink.usedAt),
          isNull(setupLink.replacedAt),
        ),
      )
      .orderBy(desc(setupLink.createdAt))
      .limit(1),
  );
  return open?.expiresAt ?? null;
}

export interface OwnerPhone {
  tenantId: string;
  membershipId: string;
  /** E.164, normalised by the caller. */
  phoneE164: string;
}

/**
 * Corrects the phone of a clinic's pending owner (an owner.phone_changed transaction, OD-99):
 * true when it changed; false when the membership is not the owner's, or the owner already has
 * an account (the policies leave such rows untouched). An invitation link naming the old phone
 * follows the new one (ON UPDATE CASCADE); the caller re-issues the link with issueOwnerLink().
 */
export async function changeOwnerPhone(tx: PlatformTx, owner: OwnerPhone): Promise<boolean> {
  assertUuid('tenantId', owner.tenantId);
  assertUuid('membershipId', owner.membershipId);
  const changed = await inTenant(tx, owner.tenantId, (sp) =>
    sp
      .update(membership)
      .set({ phoneE164: owner.phoneE164, updatedAt: sql`now()` })
      .where(and(eq(membership.tenantId, owner.tenantId), eq(membership.id, owner.membershipId)))
      .returning({ id: membership.id }),
  );
  return changed.length === 1;
}

/** Marks an existing account as a super admin (seed command only, platform.admin_created). */
export async function registerPlatformAdmin(tx: PlatformTx, userId: string): Promise<void> {
  assertUuid('userId', userId);
  await tx.insert(platformAdmin).values({ userId });
  auditTargetOf(tx)?.setTarget(userId);
}
