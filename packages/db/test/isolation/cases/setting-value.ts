// Isolation case of setting_value (A-02-04): a clinic's own setting values. shifa_app reads them
// and writes its unlocked values (UPDATE by column: `value`); the lock is the super admin's alone
// (test/settings.test.ts). Each seed writes a fresh user-scope row, so a reseed never collides.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { settingValue } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';

const KEY = 'session.idle_minutes';

export const settingValueCase = defineIsolationCase({
  table: 'setting_value',
  seed: async (tx, tenantId) => {
    await tx
      .insert(settingValue)
      .values({ tenantId, scope: 'user', scopeId: randomUUID(), key: KEY, value: 15 });
  },
  paths: {
    'the clinic’s values': (tx) => tx.select().from(settingValue),
    'one key': (tx) => tx.select().from(settingValue).where(eq(settingValue.key, KEY)),
  },
  updatable: { column: 'value', value: '60' },
});
