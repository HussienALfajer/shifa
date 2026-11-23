import { eq } from 'drizzle-orm';
import { membership } from '../../../src/index.ts';
import { fixtureId, syntheticPhones } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';

// Both tenants use the same phone: unique (tenant_id, phone_e164) must not reveal B's member.
const [PHONE, OTHER] = syntheticPhones(7302, 2);
const phone = PHONE ?? '';
const OTHER_PHONE = OTHER ?? '';
const BOUND_USER = fixtureId('isolation bound user');

export const membershipCase = defineIsolationCase({
  table: 'membership',
  seed: async (tx, tenantId) => {
    await tx.insert(membership).values({ tenantId, phoneE164: phone, displayName: 'موظف تجريبي' });
  },
  paths: {
    team: (tx) => tx.select().from(membership),
    'by phone (already in the team)': (tx) =>
      tx.select().from(membership).where(eq(membership.phoneE164, phone)),
    pending: (tx) => tx.select().from(membership).where(eq(membership.status, 'pending')),
  },
  // A-01-04: shifa_app updates named columns only (user_id is bound on the auth path).
  updatable: { column: 'display_name', value: 'موظف معدّل' },
  // A-01-05: no clinic writes a member already bound to an account, or active without one. The
  // user id needs no `user` row: the policy refuses the row before the foreign key is checked.
  refusedInserts: {
    'bound to an account': async (tx, tenantId) => {
      await tx.insert(membership).values({
        tenantId,
        userId: BOUND_USER,
        phoneE164: OTHER_PHONE,
        displayName: 'مربوط',
        status: 'active',
      });
    },
    'active without an account': async (tx, tenantId) => {
      await tx
        .insert(membership)
        .values({ tenantId, phoneE164: OTHER_PHONE, displayName: 'نشط', status: 'active' });
    },
  },
});
