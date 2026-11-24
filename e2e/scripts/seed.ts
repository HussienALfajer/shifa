// The journeys' people (slice A-01-06): the super admin through seedSuperAdmin() and two clinics
// with their owners through createClinic(), on the platform path like the real commands. Names
// and phones come from @shifa/testing only. The one-time tokens stay in memory.
import { createAuthDb, createClinic, createPlatformDb } from '@shifa/db';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { newLinkToken } from '../../apps/api/src/modules/identity/links.ts';
import { seedSuperAdmin } from '../../apps/api/src/modules/identity/super-admin-seed.ts';
import type { Seeded } from '../support/run.ts';

const SEED = 2026_11_24;
const HOUR = 3_600_000;

export interface SeedUrls {
  auth: string;
  platform: string;
  clinicWebUrl: string;
}

export async function seed(urls: SeedUrls): Promise<Seeded> {
  const random = createRandom(SEED);
  const person = () =>
    fullName(generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' }));
  const authDb = createAuthDb(urls.auth);
  const platformDb = createPlatformDb(urls.platform);
  try {
    const adminPhone = generatePhone(random, 'SY');
    const admin = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: adminPhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const adminToken = new URL(admin.setupUrl).hash.slice(1);
    const clinics: Seeded['clinics'] = [];
    for (const name of ['عيادة الرحلات الأولى', 'عيادة الرحلات الثانية']) {
      const phone = generatePhone(random, 'SY');
      const { token, hash } = newLinkToken();
      const created = await platformDb.withPlatformAdmin(
        { actorId: admin.userId, event: 'clinic.created' },
        (tx) =>
          createClinic(tx, {
            name,
            type: 'solo',
            owner: {
              displayName: person(),
              phoneE164: phone,
              link: {
                purpose: 'owner_setup',
                tokenHash: hash,
                expiresAt: new Date(Date.now() + HOUR),
              },
            },
          }),
      );
      clinics.push({ tenantId: created.tenantId, owner: { phone, token } });
    }
    return { superAdmin: { phone: adminPhone, token: adminToken }, clinics };
  } finally {
    await authDb.close();
    await platformDb.close();
  }
}
