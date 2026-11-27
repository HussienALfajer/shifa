// The journeys' people (slice A-01-06): the super admin through seedSuperAdmin() and two clinics
// with their owners through createClinic(), on the platform path like the real commands; a second
// super admin for the entry-path journeys (A-01-07), who creates their clinics through the API, a
// third for A-01-10 and a fourth for the team journeys (A-01-08). Names
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
    // The A-01-07 journeys' super admin: its link is opened in the page, not consumed by the API.
    const journeyPhone = generatePhone(random, 'SY');
    const journey = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: journeyPhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const journeyToken = new URL(journey.setupUrl).hash.slice(1);
    // The A-01-10 journeys' super admin: enrols through the screens, then creates a clinic there.
    const accountPhone = generatePhone(random, 'SY');
    const account = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: accountPhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const accountToken = new URL(account.setupUrl).hash.slice(1);
    // The A-01-08 journeys' super admin: creates the team journeys' clinics through the API.
    const teamPhone = generatePhone(random, 'SY');
    const team = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: teamPhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const teamToken = new URL(team.setupUrl).hash.slice(1);
    // The A-02-08 journeys' super admin: the clinic page tabs on a clinic of their own.
    const tabsPhone = generatePhone(random, 'SY');
    const tabs = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: tabsPhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const tabsToken = new URL(tabs.setupUrl).hash.slice(1);
    // The A-02-09 journeys' super admin: flags, announcements, cities and areas on admin web.
    const consolePhone = generatePhone(random, 'SY');
    const consoleAdmin = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: consolePhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const consoleToken = new URL(consoleAdmin.setupUrl).hash.slice(1);
    // The A-02-10 journeys' super admin: a limit raised, support access, an announcement, each
    // seen in clinic web.
    const clinicWebPhone = generatePhone(random, 'SY');
    const clinicWebAdmin = await seedSuperAdmin({
      authDb,
      platformDb,
      phone: clinicWebPhone,
      name: person(),
      clinicWebUrl: urls.clinicWebUrl,
    });
    const clinicWebToken = new URL(clinicWebAdmin.setupUrl).hash.slice(1);
    const clinics: Seeded['clinics'] = [];
    // A-01-07 checkpoint 5: the third clinic's owner walks the screens by keyboard; the fourth's
    // link checks the browser history and the used-link page (refusals.spec.ts).
    for (const name of [
      'عيادة الرحلات الأولى',
      'عيادة الرحلات الثانية',
      'عيادة الرحلات الثالثة',
      'عيادة الرحلات الرابعة',
    ]) {
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
    return {
      superAdmin: { phone: adminPhone, token: adminToken },
      journeyAdmin: { phone: journeyPhone, token: journeyToken },
      accountAdmin: { phone: accountPhone, token: accountToken },
      teamAdmin: { phone: teamPhone, token: teamToken },
      tabsAdmin: { phone: tabsPhone, token: tabsToken },
      consoleAdmin: { phone: consolePhone, token: consoleToken },
      clinicWebAdmin: { phone: clinicWebPhone, token: clinicWebToken },
      clinics,
    };
  } finally {
    await authDb.close();
    await platformDb.close();
  }
}
