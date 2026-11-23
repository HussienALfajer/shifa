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
      // A clinic writes links of about 72 h only (A-01-04 security review L2).
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  },
  // A-01-04: shifa_app only marks links replaced.
  updatable: { column: 'replaced_at', value: '2026-01-01T00:00:00Z' },
  paths: {
    'open links (re-issue replaces them)': (tx) =>
      tx.select().from(setupLink).where(isNull(setupLink.replacedAt)),
    'by token hash': (tx) => tx.select().from(setupLink).where(eq(setupLink.tokenHash, HASH)),
  },
});
