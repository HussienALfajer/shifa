// A-01a criterion 13: super admins come from the seed command only. It takes a phone and a name,
// refuses NODE_ENV=production without --allow-production, never takes over an existing account,
// stores the link token only as a hash, and audits the creation (platform.admin_created).
import { createHash } from 'node:crypto';
import { platformAdmin, verification } from '@shifa/db';
import {
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testPlatformDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSeedArgs, SeedError, seedSuperAdmin } from '../../src/modules/identity/index.ts';
import { platformAuditRows, resetDatabase, tokenOf } from '../platform/support.ts';
import { seedPerson } from './support.ts';

const [FIRST = '', TAKEN = ''] = syntheticPhones(2026_11_29, 2);
const seed = (phone: string) =>
  seedSuperAdmin({
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    phone,
    name: 'مشرف تجريبي',
    clinicWebUrl: 'https://clinic.shifa.invalid',
  });

beforeEach(async () => {
  await resetDatabase();
});

describe('seed:super-admin arguments', () => {
  it('needs a phone and a name', () => {
    expect(parseSeedArgs(['--phone', FIRST, '--name', 'م'], undefined)).toEqual({
      phone: FIRST,
      name: 'م',
    });
    expect(() => parseSeedArgs(['--phone', FIRST], undefined)).toThrow(SeedError);
    expect(() => parseSeedArgs(['--name', 'م', '--phone'], undefined)).toThrow(SeedError);
  });

  it('refuses production without --allow-production', () => {
    const argv = ['--phone', FIRST, '--name', 'م'];
    expect(() => parseSeedArgs(argv, 'production')).toThrow(/allow-production/);
    expect(parseSeedArgs([...argv, '--allow-production'], 'production').phone).toBe(FIRST);
  });
});

describe('seedSuperAdmin()', () => {
  it('creates a super admin with a hashed one-time link, audited', async () => {
    const seeded = await seed(FIRST);
    const token = tokenOf(seeded.setupUrl);
    const hash = createHash('sha256').update(token).digest('hex');
    const rows = await superuserDb(workerDatabaseName()).select().from(verification);
    expect(rows.map((r) => r.value)).toEqual([hash]);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(await superuserDb(workerDatabaseName()).select().from(platformAdmin)).toMatchObject([
      { userId: seeded.userId },
    ]);
    expect(
      (await platformAuditRows()).filter((r) => r.event === 'platform.admin_created'),
    ).toMatchObject([{ actorId: seeded.userId, targetId: seeded.userId, tenantId: null }]);
  });

  it('never takes over an existing account', async () => {
    await seedPerson(TAKEN);
    await expect(seed(TAKEN)).rejects.toThrow(SeedError);
    expect(await superuserDb(workerDatabaseName()).select().from(platformAdmin)).toHaveLength(0);
  });

  it('refuses a malformed phone', async () => {
    await expect(seed('12')).rejects.toThrow(SeedError);
  });
});
