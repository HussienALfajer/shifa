// Isolation cases of the A-02-07 tenant tables. announcement_target (the clinics a selected
// announcement is for) is read-only for shifa_app: the runner seeds it as the owner inside each
// tenant's context and expects every shifa_app write refused by privileges; the announcement row
// itself is a platform row, written by the superuser here (only shifa_platform writes it in the
// product). usage_daily (a clinic's daily counters) is written by shifa_app in its own clinic.
import { eq, sql } from 'drizzle-orm';
import { announcementTarget, usageDaily } from '../../../src/index.ts';
import { superuserDb, workerDatabaseName } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';

const ANNOUNCEMENT = '00000000-0000-4000-8000-0000000a0701';
const DAY = '2026-12-02';

export const announcementTargetCase = defineIsolationCase({
  table: 'announcement_target',
  prepare: async () => {
    await superuserDb(workerDatabaseName()).execute(sql`insert into announcement
      (id, body, level, starts_at, target, created_by, created_by_name)
      values (${ANNOUNCEMENT}, 'إعلان تجريبي للعزل', 'info', now() - interval '1 hour',
              'selected', '00000000-0000-4000-8000-0000000000f1', 'مشرف تجريبي')
      on conflict do nothing`);
  },
  seed: async (tx, tenantId) => {
    await tx.insert(announcementTarget).values({ tenantId, announcementId: ANNOUNCEMENT });
  },
  paths: {
    'targets of the clinic': (tx) => tx.select().from(announcementTarget),
    'one announcement': (tx) =>
      tx
        .select()
        .from(announcementTarget)
        .where(eq(announcementTarget.announcementId, ANNOUNCEMENT)),
  },
});

export const usageDailyCase = defineIsolationCase({
  table: 'usage_daily',
  seed: async (tx, tenantId) => {
    await tx.insert(usageDaily).values({ tenantId, day: DAY, key: 'sign_ins', value: 3 });
  },
  paths: {
    'the clinic’s counters': (tx) => tx.select().from(usageDaily),
    'one day': (tx) => tx.select().from(usageDaily).where(eq(usageDaily.day, DAY)),
  },
});
