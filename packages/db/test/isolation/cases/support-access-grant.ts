// Isolation case of support_access_grant (A-02-05): a clinic's support grants. shifa_app reads its
// own and an owner ends an open one (UPDATE by column, restrictive policy); it never inserts or
// deletes one (the platform opens grants), so the runner seeds as the owner in each tenant: an ended
// grant and an open one. The runner's update without WHERE reaches the open one and is refused.
import { isNotNull } from 'drizzle-orm';
import { supportAccessGrant } from '../../../src/index.ts';
import { fixtureId } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';

const ADMIN = fixtureId('isolation super admin');

export const supportAccessGrantCase = defineIsolationCase({
  table: 'support_access_grant',
  seed: async (tx, tenantId) => {
    const openedAt = new Date(Date.now() - 3_600_000);
    await tx.insert(supportAccessGrant).values({
      tenantId,
      adminUserId: ADMIN,
      adminName: 'مشرف تجريبي',
      reason: 'سبب تجريبي لدخول الدعم',
      openedAt,
      expiresAt: new Date(openedAt.getTime() + 1_800_000),
      endedAt: new Date(openedAt.getTime() + 600_000),
      endedBy: ADMIN,
      endedByName: 'مشرف تجريبي',
      endReason: 'admin',
    });
    // And an open, unexpired grant (review 12): the clinic's banner reads it.
    await tx.insert(supportAccessGrant).values({
      tenantId,
      adminUserId: ADMIN,
      adminName: 'مشرف تجريبي',
      reason: 'سبب تجريبي لدخول الدعم',
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  },
  paths: {
    'the clinic’s grants': (tx) =>
      tx
        .select({
          id: supportAccessGrant.id,
          tenantId: supportAccessGrant.tenantId,
          adminName: supportAccessGrant.adminName,
          reason: supportAccessGrant.reason,
          openedAt: supportAccessGrant.openedAt,
          endReason: supportAccessGrant.endReason,
        })
        .from(supportAccessGrant)
        .orderBy(supportAccessGrant.openedAt),
    'ended grants': (tx) =>
      tx
        .select({ id: supportAccessGrant.id, tenantId: supportAccessGrant.tenantId })
        .from(supportAccessGrant)
        .where(isNotNull(supportAccessGrant.endedAt)),
  },
  updatable: { column: 'end_reason', value: 'owner' },
  withoutPrivilege: ['insert', 'delete'],
  // Setting one column of the open grant is no owner's end: the restrictive policy refuses it.
  updateRefused: true,
});
