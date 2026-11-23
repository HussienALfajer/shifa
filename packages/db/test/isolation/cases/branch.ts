import { isNull } from 'drizzle-orm';
import { branch } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';

export const branchCase = defineIsolationCase({
  table: 'branch',
  seed: async (tx, tenantId) => {
    await tx.insert(branch).values([
      { tenantId, name: 'فرع الاختبار' },
      { tenantId, name: 'فرع مؤرشف', archivedAt: new Date('2026-01-01T00:00:00Z') },
    ]);
  },
  paths: {
    'all branches': (tx) => tx.select().from(branch),
    'active branches (switcher)': (tx) => tx.select().from(branch).where(isNull(branch.archivedAt)),
  },
});
