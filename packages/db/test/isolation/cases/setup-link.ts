import { eq, isNull } from 'drizzle-orm';
import { setupLink } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';
import { parentsOf, prepareMemberships } from './parents.ts';

// The same hash in both tenants: a tenant-scoped lookup must not find B's link.
const HASH = 'e5'.repeat(32);

export const setupLinkCase = defineIsolationCase({
  table: 'setup_link',
  prepare: prepareMemberships,
  seed: async (tx, tenantId) => {
    await tx.insert(setupLink).values({
      tenantId,
      membershipId: parentsOf(tenantId).membership,
      purpose: 'member_setup',
      tokenHash: HASH,
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
  },
  paths: {
    'open links (re-issue replaces them)': (tx) =>
      tx.select().from(setupLink).where(isNull(setupLink.replacedAt)),
    'by token hash': (tx) => tx.select().from(setupLink).where(eq(setupLink.tokenHash, HASH)),
  },
});
