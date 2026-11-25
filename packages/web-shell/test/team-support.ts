// Fixtures of the team page and the member drawer (slice A-01-08 checkpoint 3), as in the approved
// prototype `Team08` ("Shifa Screens · Clinic web", page "A-01-08 Team batch"): the owner of a
// three-branch clinic, six members (the owner themselves, a doctor in two branches, an assistant
// with TOTP, a pending receptionist, a pending accountant whose link expired, a deactivated
// receptionist), the sensitive-key catalogue and the routes' answers. Synthetic only.
import type { SessionView } from '@shifa/contracts';
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { flush, type Rendered, renderShell } from './render.tsx';
import { type FakeApi, fakeApi, json, SESSION } from './support.ts';

const random = createRandom(2026_11_29);
const person = (sex: 'male' | 'female') => {
  const n = generatePersonName(random, { sex, adult: true, region: 'aleppo' });
  return `${n.given} ${n.family}`;
};
const phone = () => generatePhone(random, 'SY');

export const ID = (n: number) => `7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e${String(n).padStart(2, '0')}`;
export const TENANT = ID(1);
export const CLINIC = `مجمع ${person('male').split(' ')[1] ?? ''} الطبي`;

export const B_MAIN = { id: ID(11), name: 'الفرع الرئيسي' };
export const B_SECOND = { id: ID(12), name: 'فرع الجميلية' };
export const B_THIRD = { id: ID(13), name: 'فرع أعزاز' };
const BRANCHES = [B_MAIN, B_SECOND, B_THIRD];

const branch = (b: { id: string; name: string } | null) => ({
  branchId: b?.id ?? null,
  branchName: b?.name ?? null,
});

export const NOTES = 'clinical.notes.view';

type Role = 'owner' | 'doctor' | 'assistant' | 'receptionist' | 'accountant';
type Status = 'pending' | 'active' | 'deactivated';

export interface Member {
  id: string;
  name: string;
  phone: string;
  status: Status;
  roles: { role: Role; branchId: string | null; branchName: string | null }[];
  lastActiveAt: string | null;
  linkExpiresAt: string | null;
  isSelf: boolean;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

export const SELF: Member = {
  id: ID(21),
  name: person('male'),
  phone: phone(),
  status: 'active',
  roles: [{ role: 'owner', ...branch(null) }],
  lastActiveAt: hoursAgo(0),
  linkExpiresAt: null,
  isSelf: true,
};
export const DOCTOR: Member = {
  id: ID(22),
  name: `د. ${person('female')}`,
  phone: phone(),
  status: 'active',
  roles: [
    { role: 'doctor', ...branch(B_MAIN) },
    { role: 'doctor', ...branch(B_SECOND) },
  ],
  lastActiveAt: hoursAgo(2),
  linkExpiresAt: null,
  isSelf: false,
};
export const ASSISTANT: Member = {
  id: ID(23),
  name: person('female'),
  phone: phone(),
  status: 'active',
  roles: [{ role: 'assistant', ...branch(B_MAIN) }],
  lastActiveAt: hoursAgo(5),
  linkExpiresAt: null,
  isSelf: false,
};
export const RECEPTION: Member = {
  id: ID(24),
  name: person('male'),
  phone: phone(),
  status: 'pending',
  roles: [{ role: 'receptionist', ...branch(B_SECOND) }],
  lastActiveAt: null,
  linkExpiresAt: inDays(2),
  isSelf: false,
};
export const EXPIRED: Member = {
  id: ID(25),
  name: person('male'),
  phone: phone(),
  status: 'pending',
  roles: [{ role: 'accountant', ...branch(null) }],
  lastActiveAt: null,
  linkExpiresAt: inDays(-1),
  isSelf: false,
};
export const LEFT: Member = {
  id: ID(26),
  name: person('female'),
  phone: phone(),
  status: 'deactivated',
  roles: [{ role: 'receptionist', ...branch(B_THIRD) }],
  lastActiveAt: hoursAgo(400),
  linkExpiresAt: null,
  isSelf: false,
};
export const MEMBERS = [SELF, DOCTOR, ASSISTANT, RECEPTION, EXPIRED, LEFT];

/** Doctor and assistant on, the others off (A-01b criterion 6). */
const NOTES_ROLES: Role[] = ['doctor', 'assistant'];

export interface Detail extends Member {
  permissions: { key: string; roleDefault: boolean; granted: boolean; overridden: boolean }[];
  isLastOwner: boolean;
  mfaEnrolled: boolean;
}

export function detail(m: Member, extra: Partial<Detail> = {}): Detail {
  const roleDefault = m.roles.some((r) => NOTES_ROLES.includes(r.role));
  return {
    ...m,
    permissions: [{ key: NOTES, roleDefault, granted: roleDefault, overridden: false }],
    isLastOwner: m.isSelf,
    mfaEnrolled: m.status === 'active',
    ...extra,
  };
}

export const OWNER_SESSION: SessionView = {
  ...SESSION,
  userId: ID(31),
  tenantId: TENANT,
  branchId: B_MAIN.id,
  roles: [{ role: 'owner', tenantId: TENANT, branchId: null }],
};
export const DOCTOR_SESSION: SessionView = {
  ...OWNER_SESSION,
  roles: [{ role: 'doctor', tenantId: TENANT, branchId: B_MAIN.id }],
};

const myClinics = (solo: boolean) => ({
  clinics: [
    {
      tenantId: TENANT,
      name: CLINIC,
      status: 'active',
      selectable: true,
      roles: ['owner'],
      tenantWide: true,
      lastActiveAt: hoursAgo(0),
      solo,
      branches: solo ? [B_MAIN] : BRANCHES,
    },
  ],
  invitations: [],
});

const branchRow = (b: { id: string; name: string }) => ({
  ...b,
  address: null,
  phone: null,
  archivedAt: null,
  memberCount: 1,
});

export const MEMBERS_PATH = '/api/team/members';
export const memberPath = (id: string) => `/api/team/members/${id}`;

export interface TeamOptions {
  members?: Member[];
  details?: Record<string, Detail>;
  solo?: boolean;
  session?: SessionView;
}

/** The fake API of an owner on the team page; every answer can be replaced per test. */
export function teamApi(options: TeamOptions = {}): FakeApi {
  const members = options.members ?? MEMBERS;
  const api = fakeApi(options.session ?? OWNER_SESSION);
  api.answers['/api/me/clinics'] = () => json(200, myClinics(options.solo === true));
  api.answers[MEMBERS_PATH] = () => json(200, { members });
  api.answers['/api/team/permissions'] = () =>
    json(200, { keys: [{ key: NOTES, roles: NOTES_ROLES }] });
  api.answers['/api/branches'] = () =>
    json(200, {
      active: (options.solo === true ? [B_MAIN] : BRANCHES).map(branchRow),
      archived: [],
    });
  for (const m of members) {
    api.answers[memberPath(m.id)] = () => json(200, options.details?.[m.id] ?? detail(m));
  }
  return api;
}

export async function openTeam(api: FakeApi, path = '/team'): Promise<Rendered> {
  const r = await renderShell('clinic', api, path);
  await flush(40);
  return r;
}

/** The open drawer (the member's or «إضافة موظف»). */
export function drawer(): HTMLElement {
  const d = [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (el) => el.getAttribute('data-testid') === 'member-drawer',
  );
  if (!d) throw new Error('no member drawer');
  return d;
}

export function hasDrawer(): boolean {
  return document.body.querySelector('[data-testid="member-drawer"]') !== null;
}

/** The confirmation over the drawer. */
export function confirmation(): HTMLElement {
  const d = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
  if (!d) throw new Error('no confirmation');
  return d;
}

/** The table row (or phone card) naming `name`. */
export function rowOf(name: string): Element | null {
  for (const row of document.querySelectorAll('[role="row"], [data-testid="member-card"]')) {
    if (row.textContent.includes(name)) return row;
  }
  return null;
}

/** Clicks the label whose text is `name` inside `root` (a checkbox, a switch). */
export function choice(root: HTMLElement, name: string): HTMLElement {
  for (const label of root.querySelectorAll<HTMLElement>('label')) {
    if (label.textContent.trim() === name) return label;
  }
  throw new Error(`no choice ${name}`);
}

/** The checkbox or switch of the label `name` inside `root`. */
export function control(root: HTMLElement, name: string): HTMLElement {
  const box = choice(root, name).querySelector<HTMLElement>(
    '[role="checkbox"], [role="switch"], input',
  );
  if (!box) throw new Error(`no control in ${name}`);
  return box;
}

export const isOn = (el: HTMLElement) =>
  el.getAttribute('aria-checked') === 'true' || el.hasAttribute('data-checked');
export const isDisabled = (el: HTMLElement) =>
  el.hasAttribute('disabled') ||
  el.getAttribute('aria-disabled') === 'true' ||
  el.hasAttribute('data-disabled');

/** The role group of the drawer: its checkbox and its scope choices. */
export function roleGroup(role: Role): HTMLElement {
  const g = drawer().querySelector<HTMLElement>(`[data-testid="role-${role}"]`);
  if (!g) throw new Error(`no role group ${role}`);
  return g;
}

/** Opens a member's drawer from the name in the table. */
export function nameLink(name: string): HTMLElement {
  const row = rowOf(name);
  const link = row?.querySelector<HTMLElement>('[data-testid="member-open"]');
  if (!link) throw new Error(`no link for ${name}`);
  return link;
}
