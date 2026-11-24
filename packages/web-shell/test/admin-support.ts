// Fixtures of admin web's clinics (slice A-01-10 checkpoint 3), as in the approved prototype `Main`
// ("Shifa Screens · Admin web", page "A-01-10 Clinics"): a signed-in super admin, five clinics (one
// owner not set up, one suspended, one ending in five days), their detail and the routes'
// answers. Synthetic only.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { renderShell } from './render.tsx';
import { type FakeApi, fakeApi, json, SESSION } from './support.ts';

const random = createRandom(2026_11_28);
const person = () => {
  const n = generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' });
  return `${n.given} ${n.family}`;
};
const family = () =>
  generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }).family;

export const ADMIN = {
  ...SESSION,
  platformAdmin: true,
  mfaRequired: true,
  tenantId: null,
  roles: [],
};

export const CID = (n: number) => `5c1f4c1e-4a43-4f0e-9f61-3c3b1f6f0d${String(n).padStart(2, '0')}`;

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export interface Summary {
  id: string;
  name: string;
  type: 'solo' | 'multi_doctor' | 'multi_branch';
  status: 'trial' | 'active' | 'suspended';
  subscriptionEnd: string | null;
  ownerName: string | null;
  ownerStatus: 'pending' | 'active' | 'deactivated' | null;
  createdAt: string;
}

export const ACTIVE: Summary = {
  id: CID(1),
  name: `مجمع ${family()} الطبي`,
  type: 'multi_doctor',
  status: 'active',
  subscriptionEnd: inDays(200),
  ownerName: person(),
  ownerStatus: 'active',
  createdAt: '2026-11-10T09:00:00.000Z',
};
export const PENDING: Summary = {
  id: CID(2),
  name: `عيادة ${family()} للأسنان`,
  type: 'solo',
  status: 'trial',
  subscriptionEnd: null,
  ownerName: person(),
  ownerStatus: 'pending',
  createdAt: '2026-11-20T09:00:00.000Z',
};
export const SUSPENDED: Summary = {
  id: CID(3),
  name: `مركز ${family()} الطبي`,
  type: 'multi_branch',
  status: 'suspended',
  subscriptionEnd: inDays(-10),
  ownerName: person(),
  ownerStatus: 'active',
  createdAt: '2026-10-01T09:00:00.000Z',
};
export const ENDING: Summary = {
  id: CID(4),
  name: `عيادة ${family()} التخصصية`,
  type: 'solo',
  status: 'active',
  subscriptionEnd: inDays(5),
  ownerName: person(),
  ownerStatus: 'active',
  createdAt: '2026-09-01T09:00:00.000Z',
};
export const FIFTH: Summary = {
  id: CID(5),
  name: `عيادة ${family()}`,
  type: 'multi_doctor',
  status: 'trial',
  subscriptionEnd: inDays(60),
  ownerName: person(),
  ownerStatus: 'active',
  createdAt: '2026-08-01T09:00:00.000Z',
};
export const FIVE = [PENDING, ACTIVE, SUSPENDED, ENDING, FIFTH];

export const OWNER_PHONE = generatePhone(random, 'SY');
export const MASKED = '+963 ••• ••• 294';
export const LINK = {
  url: 'https://admin.shifa.example/setup#t=U3ludGhldGljLXNldHVwLXRva2VuLTAwMDE',
  whatsappUrl:
    'https://wa.me/?text=https%3A%2F%2Fadmin.shifa.example%2Fsetup%23t%3DU3ludGhldGljLXNldHVwLXRva2VuLTAwMDE',
  purpose: 'setup' as const,
  expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
};

export function detailOf(c: Summary, linkExpiresAt: string | null = null) {
  return {
    ...c,
    owner:
      c.ownerName === null || c.ownerStatus === null
        ? null
        : {
            membershipId: `${c.id.slice(0, -2)}99`,
            name: c.ownerName,
            status: c.ownerStatus,
            phoneMasked: MASKED,
            linkExpiresAt: c.ownerStatus === 'pending' ? linkExpiresAt : null,
          },
  };
}

/** The fake API of a signed-in super admin with these clinics; search filters by name. */
export function adminApi(clinics: Summary[] = FIVE): FakeApi {
  const fake = fakeApi(ADMIN);
  fake.answers['/api/me'] = () =>
    json(200, { userId: ADMIN.userId, name: person(), phoneE164: OWNER_PHONE });
  fake.answers['/api/platform/clinics'] = () => json(200, { clinics });
  for (const c of clinics) {
    fake.answers[`/api/platform/clinics/${c.id}`] = (body) =>
      json(
        200,
        body === undefined ? detailOf(c, LINK.expiresAt) : { ...detailOf(c), ...(body as object) },
      );
  }
  return fake;
}

export const openAdmin = (fake: FakeApi, path: string) => renderShell('admin', fake, path);
