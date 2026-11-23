import { eq } from 'drizzle-orm';
import { membership } from '../../../src/index.ts';
import { syntheticPhones } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';

// Both tenants use the same phone: unique (tenant_id, phone_e164) must not reveal B's member.
const [PHONE] = syntheticPhones(7302, 1);
const phone = PHONE ?? '';

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
});
