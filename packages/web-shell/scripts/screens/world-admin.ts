// What admin web's fake server knows (synthetic only, from @shifa/testing): a super admin and the
// platform's clinics, each with its owner card, typed from the contracts so a contract change
// breaks the canvas build. Drawn from a random of its own, so clinic web's world stays the same.
import type { ClinicDetail, SessionView } from '@shifa/contracts';
import {
  createRandom,
  FAMILY_NAMES,
  fullName,
  generatePersonName,
  generatePhone,
  type Sex,
} from '@shifa/testing';
import { ago, at, id, masked } from './world.ts';

const random = createRandom(2026_11_26);
const person = (sex: Sex) => {
  const name = generatePersonName(random, { sex, adult: true, region: 'aleppo' });
  return { short: `${name.given} ${name.family}`, full: fullName(name) };
};
const phone = () => generatePhone(random, 'SY');
const family = () => random.pick(FAMILY_NAMES);

const DAY = 86_400_000;
const MINUTE = 60_000;

const admin = person('female');
export const ADMIN_NAME = admin.full;
export const ADMIN_PHONE = phone();

/** The super admin, signed in with the second factor passed: in no clinic, with no role. */
export function adminSession(over: Partial<SessionView> = {}): SessionView {
  return {
    userId: id(31),
    sessionId: id(45),
    platformAdmin: true,
    mfa: 'verified',
    mfaRequired: true,
    tenantId: null,
    branchId: null,
    roles: [],
    idleMinutes: 15,
    idleExpiresAt: at(15 * MINUTE),
    absoluteExpiresAt: at(11 * 60 * MINUTE),
    ...over,
  };
}

export const adminProfile = () => ({ userId: id(31), name: ADMIN_NAME, phoneE164: ADMIN_PHONE });

/** A clinic of the platform and its owner's phone (the card shows it masked). */
export interface PlatformClinic {
  clinic: ClinicDetail;
  ownerPhone: string | null;
}

/** `YYYY-MM-DD`, `days` from today on this device. */
export function dayFromToday(days: number): string {
  const d = new Date(Date.now() + days * DAY);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The owner who has set up their account (a phone the API knows: a link is an invitation). */
export const ACTIVE_OWNER = { ...person('male'), phone: phone() };
/** A pending owner of another clinic: their phone cannot own a new clinic yet (OD-85). */
export const PENDING_OWNER = { ...person('female'), phone: phone() };
const OTHER_PENDING = { ...person('male'), phone: phone() };
const EXPIRED_OWNER = { ...person('male'), phone: phone() };
const SUSPENDED_OWNER = { ...person('female'), phone: phone() };
const TRIAL_OWNER = { ...person('male'), phone: phone() };
/** A number no owner has: a clinic created with it is set up from a new account's link. */
export const FREE_OWNER = { ...person('female'), phone: phone() };

export const CLINIC_NAMES = {
  active: `مجمع ${family()} الطبي`,
  pending: `عيادة ${family()} للأسنان`,
  expired: `مركز ${family()} لطب العيون`,
  suspended: `عيادة ${family()} النسائية`,
  trial: `مركز ${family()} لطب الأطفال`,
  noOwner: `عيادة ${family()} القلبية`,
  newClinic: `عيادة ${family()} الجلدية`,
};

export const ACTIVE_CLINIC = id(51);
export const PENDING_CLINIC = id(52);
export const EXPIRED_CLINIC = id(53);
export const SUSPENDED_CLINIC_ID = id(54);
export const TRIAL_CLINIC = id(55);
export const NO_OWNER_CLINIC = id(56);
/** A valid id no clinic has (the 404 page). */
export const UNKNOWN_CLINIC = id(59);

function clinic(
  n: string,
  fields: Omit<ClinicDetail, 'id' | 'ownerName' | 'ownerStatus' | 'owner'>,
  owner: { full: string; phone: string } | null,
  ownerFields: { status: 'pending' | 'active' | 'deactivated'; linkExpiresAt: string | null },
): PlatformClinic {
  return {
    ownerPhone: owner?.phone ?? null,
    clinic: {
      id: n,
      ...fields,
      ownerName: owner?.full ?? null,
      ownerStatus: owner ? ownerFields.status : null,
      owner: owner
        ? {
            membershipId: id(Number(n.slice(-2)) + 10),
            name: owner.full,
            phoneMasked: masked(owner.phone),
            ...ownerFields,
          }
        : null,
    },
  };
}

/** Six clinics, newest first: every type, status, end date and owner the list and card show. */
export function platformClinics(): PlatformClinic[] {
  return [
    clinic(
      TRIAL_CLINIC,
      {
        name: CLINIC_NAMES.trial,
        type: 'solo',
        status: 'trial',
        subscriptionEnd: dayFromToday(5),
        createdAt: ago(2 * DAY),
      },
      TRIAL_OWNER,
      { status: 'active', linkExpiresAt: null },
    ),
    clinic(
      PENDING_CLINIC,
      {
        name: CLINIC_NAMES.pending,
        type: 'solo',
        status: 'trial',
        subscriptionEnd: dayFromToday(30),
        createdAt: ago(3 * DAY),
      },
      PENDING_OWNER,
      { status: 'pending', linkExpiresAt: at(2 * DAY + 5 * 60 * MINUTE) },
    ),
    clinic(
      EXPIRED_CLINIC,
      {
        name: CLINIC_NAMES.expired,
        type: 'multi_doctor',
        status: 'trial',
        subscriptionEnd: null,
        createdAt: ago(9 * DAY),
      },
      EXPIRED_OWNER,
      { status: 'pending', linkExpiresAt: ago(2 * DAY) },
    ),
    clinic(
      ACTIVE_CLINIC,
      {
        name: CLINIC_NAMES.active,
        type: 'multi_branch',
        status: 'active',
        subscriptionEnd: dayFromToday(200),
        createdAt: ago(60 * DAY),
      },
      ACTIVE_OWNER,
      { status: 'active', linkExpiresAt: null },
    ),
    clinic(
      SUSPENDED_CLINIC_ID,
      {
        name: CLINIC_NAMES.suspended,
        type: 'multi_doctor',
        status: 'suspended',
        subscriptionEnd: dayFromToday(-12),
        createdAt: ago(120 * DAY),
      },
      SUSPENDED_OWNER,
      { status: 'active', linkExpiresAt: null },
    ),
    clinic(
      NO_OWNER_CLINIC,
      {
        name: CLINIC_NAMES.noOwner,
        type: 'solo',
        status: 'active',
        subscriptionEnd: null,
        createdAt: ago(200 * DAY),
      },
      null,
      { status: 'active', linkExpiresAt: null },
    ),
  ];
}

// The other pending owner's phone exists for the 409 of a corrected phone (owner_setup_pending).
export const OTHER_PENDING_PHONE = OTHER_PENDING.phone;
