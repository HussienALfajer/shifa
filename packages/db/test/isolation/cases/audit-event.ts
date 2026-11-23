import { desc, eq } from 'drizzle-orm';
import { auditEvent } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';

// Append-only (classification access 'append-only'): the runner expects UPDATE and DELETE to be
// refused by privileges ("permission denied"), not filtered by a policy (backlog B7).
export const auditEventCase = defineIsolationCase({
  table: 'audit_event',
  seed: async (tx, tenantId) => {
    await tx.insert(auditEvent).values({ tenantId, event: 'member.added' });
  },
  paths: {
    'latest events': (tx) => tx.select().from(auditEvent).orderBy(desc(auditEvent.at)).limit(50),
    'by event': (tx) => tx.select().from(auditEvent).where(eq(auditEvent.event, 'member.added')),
  },
});
