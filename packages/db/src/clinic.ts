// Creating a clinic (A-01a criterion 2): one tenant, one organization, one active main branch and
// a deployment route, all inside the caller's platform transaction, so they commit together
// with the audit row of withPlatformAdmin(). The owner's membership joins it in A-01-03.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { assertUuid } from './context.ts';
import type { PlatformTx } from './platform.ts';
import {
  branch,
  deploymentRoute,
  organization,
  type TenantStatus,
  type TenantType,
  tenant,
} from './schema/index.ts';

/** The first branch of every clinic (PLT-03: a solo clinic sees no branch screens). */
export const MAIN_BRANCH_NAME = 'الفرع الرئيسي';

export interface NewClinic {
  /** Generated when absent; given when the caller needs it first (tests, idempotent retries). */
  tenantId?: string;
  name: string;
  type: TenantType;
  status?: TenantStatus;
  /** ISO date (YYYY-MM-DD); no automatic effect in A-01. */
  subscriptionEnd?: string;
  idleMinutes?: 15 | 30 | 60;
  /** Defaults to 'primary' (ADR-0004: every tenant on the shared database for now). */
  databaseKey?: string;
}

export interface CreatedClinic {
  tenantId: string;
  organizationId: string;
  branchId: string;
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
  const organizationId = randomUUID();
  const branchId = randomUUID();
  await tx.insert(tenant).values({
    id: tenantId,
    name: input.name,
    type: input.type,
    status: input.status ?? 'trial',
    subscriptionEnd: input.subscriptionEnd ?? null,
    idleMinutes: input.idleMinutes ?? 30,
  });
  await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
  await tx.insert(organization).values({ id: organizationId, tenantId, name: input.name });
  await tx.insert(branch).values({ id: branchId, tenantId, name: MAIN_BRANCH_NAME });
  await tx.insert(deploymentRoute).values({
    tenantId,
    databaseKey: input.databaseKey ?? 'primary',
  });
  await tx.execute(sql`select set_config('app.tenant_id', '', true)`);
  return { tenantId, organizationId, branchId };
}
