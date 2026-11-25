// What the fake server of the screens canvas knows (synthetic only, from @shifa/testing): an owner
// of a three-branch clinic in Aleppo, their team, branches, sessions, second factor and clinics,
// typed from the contracts so a contract change breaks the canvas build. Times are relative to the
// moment the board opens, so every «منذ» and countdown reads as it does in the app.
import type {
  Branch,
  MemberDetail,
  MfaStatus,
  MyClinic,
  MyInvitation,
  MyProfile,
  SessionSummary,
  SessionView,
} from '@shifa/contracts';
import {
  createRandom,
  FAMILY_NAMES,
  fullName,
  generatePersonName,
  generatePhone,
  type Sex,
} from '@shifa/testing';

const random = createRandom(2026_11_25);
const person = (sex: Sex) => {
  const name = generatePersonName(random, { sex, adult: true, region: 'aleppo' });
  return { short: `${name.given} ${name.family}`, full: fullName(name) };
};
const phone = () => generatePhone(random, 'SY');

/** A fixed id of the canvas world (a valid UUID; the last two digits tell them apart). */
export const id = (n: number) => `5c1f4c1e-4a43-4f0e-9f61-3c3b1f6f0c${String(n).padStart(2, '0')}`;

const minutes = (n: number) => n * 60_000;
export const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
export const ago = (ms: number) => at(-ms);

export const TENANT = id(1);
export const OTHER_TENANT = id(2);
export const SUSPENDED_TENANT = id(3);
export const CLINIC = `مجمع ${random.pick(FAMILY_NAMES)} الطبي`;
export const OTHER_CLINIC = `مركز ${random.pick(FAMILY_NAMES)} لطب الأسنان`;
export const SUSPENDED_CLINIC = `مركز ${random.pick(FAMILY_NAMES)} الطبي التخصصي`;
export const INVITING_CLINIC = `مجمع ${random.pick(FAMILY_NAMES)} الطبي`;

export const B_MAIN = { id: id(11), name: 'الفرع الرئيسي' };
export const B_SECOND = { id: id(12), name: 'فرع الجميلية' };
export const B_THIRD = { id: id(13), name: 'فرع أعزاز' };
export const B_OLD = { id: id(14), name: 'فرع السليمانية' };
const OTHER_A = { id: id(15), name: 'فرع الفرقان' };
const OTHER_B = { id: id(16), name: 'فرع الشهباء' };

const owner = person('male');
export const OWNER_NAME = owner.short;
export const OWNER_PHONE = phone();

export const SESSION_ID = id(41);

/** The owner, signed in with the second factor passed, in the main branch. */
export function ownerSession(over: Partial<SessionView> = {}): SessionView {
  return {
    userId: id(21),
    sessionId: SESSION_ID,
    platformAdmin: false,
    mfa: 'verified',
    mfaRequired: true,
    tenantId: TENANT,
    branchId: B_MAIN.id,
    roles: [{ role: 'owner', tenantId: TENANT, branchId: null }],
    idleMinutes: 15,
    idleExpiresAt: at(minutes(15)),
    absoluteExpiresAt: at(minutes(11 * 60)),
    ...over,
  };
}

export function profile(): MyProfile {
  return { userId: id(21), name: owner.full, phoneE164: OWNER_PHONE };
}

export function myClinics(): MyClinic[] {
  return [
    {
      tenantId: TENANT,
      name: CLINIC,
      status: 'active',
      selectable: true,
      roles: ['owner'],
      tenantWide: true,
      lastActiveAt: ago(minutes(3)),
      solo: false,
      branches: [B_MAIN, B_SECOND, B_THIRD],
    },
    {
      tenantId: OTHER_TENANT,
      name: OTHER_CLINIC,
      status: 'active',
      selectable: true,
      roles: ['doctor'],
      tenantWide: false,
      lastActiveAt: ago(minutes(60 * 26)),
      solo: false,
      branches: [OTHER_A, OTHER_B],
    },
    {
      tenantId: SUSPENDED_TENANT,
      name: SUSPENDED_CLINIC,
      status: 'suspended',
      selectable: false,
      roles: ['doctor'],
      tenantWide: true,
      lastActiveAt: ago(minutes(60 * 24 * 40)),
      solo: true,
      branches: [{ id: id(17), name: 'الفرع الرئيسي' }],
    },
  ];
}

export function myInvitations(): MyInvitation[] {
  return [
    {
      id: id(18),
      clinicName: INVITING_CLINIC,
      roles: [{ role: 'doctor', branchName: 'الفرع الرئيسي' }],
      expiresAt: at(minutes(60 * 24 * 5)),
    },
  ];
}

export function branches(): Branch[] {
  return [
    {
      ...B_MAIN,
      address: 'حلب، الفرقان، شارع الجامعة، بناء ١٢',
      phone: phone(),
      archivedAt: null,
      memberCount: 3,
    },
    {
      ...B_SECOND,
      address: 'حلب، الجميلية، قرب الحديقة العامة',
      phone: null,
      archivedAt: null,
      memberCount: 2,
    },
    { ...B_THIRD, address: null, phone: null, archivedAt: null, memberCount: 1 },
    {
      ...B_OLD,
      address: 'حلب، السليمانية',
      phone: null,
      archivedAt: ago(minutes(60 * 24 * 60)),
      memberCount: 0,
    },
  ];
}

export const NOTES_KEY = 'clinical.notes.view';
export const NOTES_ROLES = ['doctor', 'assistant'] as const;

type Role = MemberDetail['roles'][number]['role'];
const role = (r: Role, b: { id: string; name: string } | null) => ({
  role: r,
  branchId: b?.id ?? null,
  branchName: b?.name ?? null,
});

/** The team's people, drawn once: every board of the canvas names the same people. */
const PEOPLE = {
  22: { name: `د. ${person('female').short}`, phone: phone() },
  23: { name: person('female').short, phone: phone() },
  24: { name: person('male').short, phone: phone() },
  25: { name: person('male').short, phone: phone() },
  26: { name: person('female').short, phone: phone() },
} as const;
export const DOCTOR = { id: id(22), ...PEOPLE[22] };
export const ASSISTANT = { id: id(23), ...PEOPLE[23] };
export const RECEPTION = { id: id(24), ...PEOPLE[24] };
export const ACCOUNTANT = { id: id(25), ...PEOPLE[25] };
export const LEFT = { id: id(26), ...PEOPLE[26] };

function member(
  n: number,
  roles: MemberDetail['roles'],
  over: Partial<MemberDetail> = {},
): MemberDetail {
  const defaultOn = roles.some((r) => (NOTES_ROLES as readonly string[]).includes(r.role));
  const known = (PEOPLE as Record<number, { name: string; phone: string } | undefined>)[n];
  return {
    id: id(n),
    name: known?.name ?? OWNER_NAME,
    phone: known?.phone ?? OWNER_PHONE,
    status: 'active',
    roles,
    lastActiveAt: ago(minutes(60 * (n - 20))),
    linkExpiresAt: null,
    isSelf: false,
    permissions: [
      { key: NOTES_KEY, roleDefault: defaultOn, granted: defaultOn, overridden: false },
    ],
    isLastOwner: false,
    mfaEnrolled: true,
    ...over,
  };
}

/** Six members: the owner, two doctors' roles, an assistant, a pending and an expired link, one who left. */
export function members(): MemberDetail[] {
  return [
    member(21, [role('owner', null)], {
      isSelf: true,
      isLastOwner: true,
      lastActiveAt: ago(minutes(1)),
    }),
    member(22, [role('doctor', B_MAIN), role('doctor', B_SECOND)]),
    member(23, [role('assistant', B_MAIN)], { mfaEnrolled: false }),
    member(24, [role('receptionist', B_SECOND)], {
      status: 'pending',
      lastActiveAt: null,
      linkExpiresAt: at(minutes(60 * 48)),
      mfaEnrolled: false,
    }),
    member(25, [role('accountant', null)], {
      status: 'pending',
      lastActiveAt: null,
      linkExpiresAt: ago(minutes(60 * 20)),
      mfaEnrolled: false,
    }),
    member(26, [role('receptionist', B_THIRD)], {
      status: 'deactivated',
      lastActiveAt: ago(minutes(60 * 24 * 17)),
      mfaEnrolled: false,
    }),
  ];
}

export function sessions(): SessionSummary[] {
  return [
    {
      id: SESSION_ID,
      device: 'Windows',
      browser: 'Chrome',
      createdAt: ago(minutes(50)),
      lastActiveAt: ago(minutes(0)),
      current: true,
    },
    {
      id: id(42),
      device: 'Android',
      browser: 'Chrome',
      createdAt: ago(minutes(60 * 5)),
      lastActiveAt: ago(minutes(40)),
      current: false,
    },
    {
      id: id(43),
      device: 'iPad',
      browser: 'Safari',
      createdAt: ago(minutes(60 * 30)),
      lastActiveAt: ago(minutes(60 * 22)),
      current: false,
    },
    {
      id: id(44),
      device: null,
      browser: null,
      createdAt: ago(minutes(60 * 9)),
      lastActiveAt: ago(minutes(60 * 3)),
      current: false,
    },
  ];
}

export function mfaStatus(left = 8): MfaStatus {
  return { enrolled: true, enrolledAt: ago(minutes(60 * 24 * 21)), recoveryCodesLeft: left };
}

/** Ten recovery codes, as the server formats them (synthetic). */
export function recoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const part = () => String(random.int(0, 99_999)).padStart(5, '0');
    return `${part()}-${part()}`;
  });
}

/** A TOTP key for the QR code and the manual entry (synthetic, never a real account's). */
export const TOTP_KEY = 'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP';
export const OTPAUTH = `otpauth://totp/Shifa:${encodeURIComponent('شفاء')}?secret=${TOTP_KEY.replaceAll(' ', '')}&issuer=Shifa`;

/** The person a setup link or an invitation is for. */
export const NEW_PERSON = person('female').short;
export const NEW_PHONE = phone();
/** A setup link's token: 43 base64url characters, as the page expects (synthetic). */
export const SETUP_TOKEN = 'Zk3vQ9pL2xR7mN4tB8wC1yH6sD5fG0aJk2Lm3Np4Qr5';

/** A Syrian number as a person types it (0 then nine digits). */
export const local = (e164: string) => `0${e164.slice(4)}`;
export const masked = (e164: string) => `+963 ••• ••• ${e164.slice(-3)}`;
