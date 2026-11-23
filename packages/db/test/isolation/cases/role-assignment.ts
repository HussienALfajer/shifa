import { eq, isNull } from 'drizzle-orm';
import { roleAssignment } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';
import { parentsOf, prepareBranches, prepareMemberships } from './parents.ts';

export const roleAssignmentCase = defineIsolationCase({
  table: 'role_assignment',
  prepare: async (ctx) => {
    await prepareBranches(ctx);
    await prepareMemberships(ctx);
  },
  seed: async (tx, tenantId) => {
    const { membership, branch } = parentsOf(tenantId);
    await tx.insert(roleAssignment).values([
      { tenantId, membershipId: membership, role: 'owner' },
      { tenantId, membershipId: membership, role: 'doctor', branchId: branch },
    ]);
  },
  paths: {
    'all assignments': (tx) => tx.select().from(roleAssignment),
    'tenant-wide roles': (tx) =>
      tx.select().from(roleAssignment).where(isNull(roleAssignment.branchId)),
    'owners (last-owner rule)': (tx) =>
      tx.select().from(roleAssignment).where(eq(roleAssignment.role, 'owner')),
  },
});
