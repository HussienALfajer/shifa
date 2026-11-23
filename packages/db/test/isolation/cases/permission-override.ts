import { eq } from 'drizzle-orm';
import { permissionOverride } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';
import { parentsOf, prepareMemberships } from './parents.ts';

export const permissionOverrideCase = defineIsolationCase({
  table: 'permission_override',
  prepare: prepareMemberships,
  seed: async (tx, tenantId) => {
    await tx.insert(permissionOverride).values({
      tenantId,
      membershipId: parentsOf(tenantId).membership,
      key: 'clinical.notes.view',
      granted: false,
    });
  },
  paths: {
    'all overrides': (tx) => tx.select().from(permissionOverride),
    'by key': (tx) =>
      tx.select().from(permissionOverride).where(eq(permissionOverride.key, 'clinical.notes.view')),
  },
});
