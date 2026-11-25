// Fixtures of the branches page (slice A-01-08 checkpoint 4; prototype `Team08`, the `GET
// /branches`, `POST`/`PATCH /branches`, archive-preview, archive and restore rows of the slice's
// table): the owner of a three-branch clinic with one archived branch, and the routes' answers.
// The member names a preview lists come from the synthetic generator. Synthetic only.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { flush, type Rendered, renderShell } from './render.tsx';
import { type FakeApi, fakeApi, json } from './support.ts';
import { B_MAIN, B_SECOND, B_THIRD, CLINIC, ID, OWNER_SESSION, TENANT } from './team-support.ts';

const random = createRandom(2026_11_30);
export const person = () => {
  const n = generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' });
  return `${n.given} ${n.family}`;
};
export const BRANCH_PHONE = generatePhone(random, 'SY');
export const NEW_BRANCH_PHONE = generatePhone(random, 'SY');

export interface BranchRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  archivedAt: string | null;
  memberCount: number;
}

export const MAIN: BranchRow = {
  ...B_MAIN,
  address: 'شارع بارون',
  phone: BRANCH_PHONE,
  archivedAt: null,
  memberCount: 4,
};
export const SECOND: BranchRow = {
  ...B_SECOND,
  address: null,
  phone: null,
  archivedAt: null,
  memberCount: 2,
};
export const THIRD: BranchRow = {
  ...B_THIRD,
  address: 'الشارع العام',
  phone: null,
  archivedAt: null,
  memberCount: 0,
};
export const OLD: BranchRow = {
  id: ID(14),
  name: 'فرع الشهباء',
  address: null,
  phone: null,
  archivedAt: '2026-10-02T09:00:00.000Z',
  memberCount: 0,
};

export const BRANCHES_PATH = '/api/branches';
export const branchPath = (id: string) => `/api/branches/${id}`;
export const previewPath = (id: string) => `/api/branches/${id}/archive-preview`;
export const archivePath = (id: string) => `/api/branches/${id}/archive`;
export const restorePath = (id: string) => `/api/branches/${id}/restore`;

export interface BranchesOptions {
  active?: BranchRow[];
  archived?: BranchRow[];
  /** GET /me/clinics says the clinic has one active branch. */
  solo?: boolean;
  session?: typeof OWNER_SESSION;
}

const clinics = (solo: boolean, active: BranchRow[]) => ({
  clinics: [
    {
      tenantId: TENANT,
      name: CLINIC,
      status: 'active',
      selectable: true,
      roles: ['owner'],
      tenantWide: true,
      lastActiveAt: new Date().toISOString(),
      solo,
      branches: active.map((b) => ({ id: b.id, name: b.name })),
    },
  ],
  invitations: [],
});

/** The owner's fake API; `GET /api/branches` answers the lists as they stand in `state`. */
export function branchesApi(options: BranchesOptions = {}) {
  const state = {
    active: options.active ?? [MAIN, SECOND, THIRD],
    archived: options.archived ?? [OLD],
  };
  const api: FakeApi = fakeApi(options.session ?? OWNER_SESSION);
  // As the server: solo while one branch is active, read at each answer.
  api.answers['/api/me/clinics'] = () =>
    json(200, clinics(options.solo ?? state.active.length === 1, state.active));
  api.answers[BRANCHES_PATH] = () => json(200, state);
  api.answers['/api/team/members'] = () => json(200, { members: [] });
  api.answers['/api/team/permissions'] = () => json(200, { keys: [] });
  api.answers['/api/clinic/settings'] = () => json(200, { idleMinutes: 30 });
  return { api, state };
}

export async function openBranches(api: FakeApi, path = '/branches'): Promise<Rendered> {
  const r = await renderShell('clinic', api, path);
  await flush(40);
  return r;
}

/** The card of an active branch. */
export function cardOf(name: string): HTMLElement {
  for (const el of document.querySelectorAll<HTMLElement>('[data-testid="branch-card"]')) {
    if (el.querySelector('h3')?.textContent === name) return el;
  }
  throw new Error(`no card ${name}`);
}

/** The row of an archived branch. */
export function archivedRowOf(name: string): HTMLElement {
  for (const el of document.querySelectorAll<HTMLElement>('[data-testid="branch-archived"]')) {
    if (el.textContent.includes(name)) return el;
  }
  throw new Error(`no archived row ${name}`);
}

export function dialog(): HTMLElement {
  const d = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!d) throw new Error('no dialog');
  return d;
}

export function confirmation(): HTMLElement {
  const d = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
  if (!d) throw new Error('no confirmation');
  return d;
}

export const hasDialog = () =>
  document.body.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
