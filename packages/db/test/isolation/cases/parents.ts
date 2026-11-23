// Parent rows the A-01 isolation cases need (A-01b criterion 1): written in prepare(), through
// withTenant() as shifa_app like any tenant row, so a case's seed writes only its own table.
import {
  fixtureId,
  insertBranch,
  insertMembership,
  syntheticPhones,
} from '../../../test-harness/index.ts';
import type { PrepareContext } from '../define.ts';

/** Fixed parent ids per tenant, so seeds and paths can refer to them. */
export const parentsOf = (tenantId: string) => ({
  branch: fixtureId(`isolation branch ${tenantId}`),
  membership: fixtureId(`isolation membership ${tenantId}`),
});

const [PHONE] = syntheticPhones(7301, 1);

export async function prepareBranches(ctx: PrepareContext): Promise<void> {
  for (const tenantId of ctx.tenants) {
    await ctx.inTenant(tenantId, (tx) =>
      insertBranch(tx, { id: parentsOf(tenantId).branch, tenantId }),
    );
  }
}

export async function prepareMemberships(ctx: PrepareContext): Promise<void> {
  for (const tenantId of ctx.tenants) {
    // The same phone in both tenants: one person invited by two clinics (A-01b edge case).
    await ctx.inTenant(tenantId, (tx) =>
      insertMembership(tx, { id: parentsOf(tenantId).membership, tenantId, phone: PHONE ?? '' }),
    );
  }
}
