import { eq } from 'drizzle-orm';
import { organization } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';

export const organizationCase = defineIsolationCase({
  table: 'organization',
  seed: async (tx, tenantId) => {
    await tx.insert(organization).values({ tenantId, name: 'منظمة اختبار' });
  },
  paths: {
    "the clinic's organization": (tx) => tx.select().from(organization),
    'by name': (tx) => tx.select().from(organization).where(eq(organization.name, 'منظمة اختبار')),
  },
});
