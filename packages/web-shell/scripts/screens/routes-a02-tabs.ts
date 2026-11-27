// The fake server's routes of admin web's clinic page tabs (A-02-08), answered as the contracts in
// packages/contracts/src/{entitlements,settings,support,usage}.ts say: entitlements and overrides
// (400 on the refused field, 404 for an unknown clinic or key), the override history and the type
// preview; settings with the super admin's lock (409 `setting_not_lockable` or `setting_locked`);
// support grants (409 `support_active`, `support_ended`) and usage. Only a super admin is answered.
import type { EntitlementItem, OverrideEvent, SettingView } from '@shifa/contracts';
import { fail, ok, type Reply, type Request, type RouteTable } from './server.ts';
import type { World } from './state.ts';
import { at } from './world.ts';
import {
  type ClinicTabs,
  type ClinicType,
  damascusDays,
  grantId,
  idleSetting,
  LIMIT_KEYS,
  PLANS,
  tabsOf,
} from './world-a02-tabs.ts';
import { ADMIN_NAME, type PlatformClinic } from './world-admin.ts';

const field = (body: unknown, name: string): unknown =>
  (body as Record<string, unknown> | undefined)?.[name];

const refused = (path: string): Reply =>
  fail(400, 'validation_failed', { details: [{ path, code: 'invalid' }] });

/** A route of one clinic: 401 signed out, 403 not a super admin, 404 no such clinic. */
function clinicRoute(run: (tabs: ClinicTabs, p: PlatformClinic, request: Request) => Reply) {
  return (request: Request, world: World): Reply => {
    if (!world.session) return fail(401, 'unauthorized');
    if (!world.session.platformAdmin) return fail(403, 'forbidden');
    const p = world.platform.find((x) => x.clinic.id === request.id);
    if (!p) return fail(404, 'not_found');
    return run(tabsOf(world, p.clinic.id), p, request);
  };
}

const today = () => damascusDays(1)[0] ?? '';

/** One key as the list answers it: the plan's value, the override and what counts now. */
export function itemOf(tabs: ClinicTabs, type: ClinicType, key: string): EntitlementItem {
  const planValue = PLANS[type][key] ?? 0;
  const override = tabs.overrides[key] ?? null;
  return {
    key,
    kind: 'limit',
    planValue,
    override,
    effective: override && !override.expired ? override.value : planValue,
    used: tabs.used[key] ?? null,
  };
}

const keyOf = (request: Request) => {
  const key = request.params['key'] ?? '';
  return LIMIT_KEYS.includes(key) ? key : null;
};

const record = (tabs: ClinicTabs, key: string, event: Omit<OverrideEvent, 'at' | 'byName'>) => {
  (tabs.history[key] ??= []).unshift({
    ...event,
    at: new Date().toISOString(),
    byName: ADMIN_NAME,
  });
};

function setOverride(tabs: ClinicTabs, p: PlatformClinic, request: Request): Reply {
  const key = keyOf(request);
  if (key === null) return fail(404, 'not_found');
  const value = field(request.body, 'value');
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100_000) {
    return refused('body.value');
  }
  const reasonRaw = field(request.body, 'reason');
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  if (reason.length < 10 || reason.length > 500) return refused('body.reason');
  const expiry = field(request.body, 'expiresAt') ?? null;
  if (expiry !== null && (typeof expiry !== 'string' || expiry <= today())) {
    return refused('body.expiresAt');
  }
  const before = tabs.overrides[key];
  const kept = before && !before.expired ? before : null;
  tabs.overrides[key] = {
    value,
    reason,
    expiresAt: expiry,
    expired: false,
    setByName: ADMIN_NAME,
    setAt: new Date().toISOString(),
  };
  record(tabs, key, {
    kind: kept ? 'changed' : 'set',
    before: kept ? { value: kept.value, expiresAt: kept.expiresAt } : null,
    after: { value, expiresAt: expiry },
    reason,
  });
  return ok(itemOf(tabs, p.clinic.type, key));
}

function removeOverride(tabs: ClinicTabs, p: PlatformClinic, request: Request): Reply {
  const key = keyOf(request);
  const before = key === null ? undefined : tabs.overrides[key];
  if (key === null || !before) return fail(404, 'not_found');
  tabs.overrides = Object.fromEntries(Object.entries(tabs.overrides).filter(([k]) => k !== key));
  record(tabs, key, {
    kind: 'removed',
    before: { value: before.value, expiresAt: before.expiresAt },
    after: null,
    reason: null,
  });
  return ok(itemOf(tabs, p.clinic.type, key));
}

/** What each limit becomes under another type: the plan's value, or an override that stays. */
function preview(tabs: ClinicTabs, p: PlatformClinic, { query }: Request): Reply {
  const type = query.get('type');
  if (type !== 'solo' && type !== 'multi_doctor' && type !== 'multi_branch') {
    return refused('query.type');
  }
  return ok({
    type,
    limits: LIMIT_KEYS.map((key) => {
      const now = itemOf(tabs, p.clinic.type, key);
      const kept = now.override && !now.override.expired ? now.override.value : null;
      const next = typeof kept === 'number' ? kept : (PLANS[type][key] ?? 0);
      const used = now.used ?? 0;
      return { key, current: Number(now.effective), next, used, over: next < used };
    }),
  });
}

/** The clinic moves to another type's plan (PATCH /platform/clinics/:id with `type`). */
export function changeType(world: World, p: PlatformClinic, type: ClinicType): void {
  const tabs = tabsOf(world, p.clinic.id);
  for (const key of LIMIT_KEYS) {
    const before = PLANS[p.clinic.type][key] ?? 0;
    const after = PLANS[type][key] ?? 0;
    if (before === after) continue;
    record(tabs, key, {
      kind: 'type_changed',
      before: { value: before, expiresAt: null },
      after: { value: after, expiresAt: null },
      reason: null,
    });
  }
  p.clinic.type = type;
}

function lock(tabs: ClinicTabs, _p: PlatformClinic, request: Request): Reply {
  const setting = tabs.settings.find((s) => s.key === request.params['key']);
  if (!setting) return fail(404, 'not_found');
  if (!setting.lockable) return fail(409, 'setting_not_lockable');
  if (setting.locked && setting.lockedBy !== 'organization') return fail(409, 'setting_locked');
  const value = field(request.body, 'value') as SettingView['value'] | undefined;
  if (value === undefined || (setting.choices !== null && !setting.choices.includes(value))) {
    return refused('body.value');
  }
  Object.assign(setting, { value, source: 'organization', locked: true, lockedBy: 'organization' });
  return ok(setting);
}

function unlock(tabs: ClinicTabs, _p: PlatformClinic, request: Request): Reply {
  const at = tabs.settings.findIndex((s) => s.key === request.params['key']);
  const setting = tabs.settings[at];
  if (!setting || !(setting.locked && setting.lockedBy === 'organization')) {
    return fail(404, 'not_found');
  }
  // The value is inherited again: the cascade's default for this key.
  const inherited = idleSetting({ key: setting.key });
  tabs.settings[at] = inherited;
  return ok(inherited);
}

/** An open grant past its expiry becomes a log row, ended by its expiry. */
function settle(tabs: ClinicTabs) {
  for (const g of tabs.grants) {
    if (g.endedAt === null && Date.parse(g.expiresAt) <= Date.now()) {
      Object.assign(g, { endedAt: g.expiresAt, endedBy: 'expiry', endedByName: null });
    }
  }
}

const mineIn = (tabs: ClinicTabs) =>
  tabs.grants.find((g) => g.endedAt === null && g.adminName === ADMIN_NAME) ?? null;

/** A single-use hand-off to clinic web (an example host; 43 base64url characters). */
const handoffUrl = () =>
  'https://clinic.example/support#U3ludGhldGljLWhhbmRvZmYtdG9rZW4tY2FudmFzMDE';

let grants = 10;

function openGrant(tabs: ClinicTabs, _p: PlatformClinic, { body }: Request): Reply {
  settle(tabs);
  const raw = field(body, 'reason');
  const reason = typeof raw === 'string' ? raw.trim() : '';
  if (reason.length < 10 || reason.length > 500) return refused('body.reason');
  const minutes = field(body, 'minutes');
  if (typeof minutes !== 'number' || ![30, 60, 120, 240].includes(minutes)) {
    return refused('body.minutes');
  }
  if (mineIn(tabs)) return fail(409, 'support_active');
  grants += 1;
  const grant = {
    id: grantId(grants),
    adminName: ADMIN_NAME,
    reason,
    startedAt: new Date().toISOString(),
    expiresAt: at(minutes * 60_000),
    endedAt: null,
    endedBy: null,
    endedByName: null,
  };
  tabs.grants.unshift(grant);
  return ok({ grant, handoffUrl: handoffUrl() }, 201);
}

/** This super admin's grant by its id, wherever it is: 404 another's, 409 one that ended. */
function grantAction(run: (grant: ClinicTabs['grants'][number]) => Reply) {
  return (request: Request, world: World): Reply => {
    if (!world.session) return fail(401, 'unauthorized');
    if (!world.session.platformAdmin) return fail(403, 'forbidden');
    for (const tabs of Object.values(world.tabs.clinics)) {
      settle(tabs);
      const grant = tabs.grants.find((g) => g.id === request.id);
      if (grant?.adminName !== ADMIN_NAME) continue;
      return grant.endedAt === null ? run(grant) : fail(409, 'support_ended');
    }
    return fail(404, 'not_found');
  };
}

export const a02TabRoutes: RouteTable = {
  'GET /platform/clinics/:id/entitlements': clinicRoute((tabs, p) =>
    ok({
      plan: p.clinic.type,
      items: LIMIT_KEYS.map((key) => itemOf(tabs, p.clinic.type, key)),
    }),
  ),
  'PUT /platform/clinics/:id/overrides/:key': clinicRoute(setOverride),
  'DELETE /platform/clinics/:id/overrides/:key': clinicRoute(removeOverride),
  'GET /platform/clinics/:id/overrides/:key/history': clinicRoute((tabs, _p, request) => {
    const key = keyOf(request);
    return key === null ? fail(404, 'not_found') : ok({ events: tabs.history[key] ?? [] });
  }),
  'GET /platform/clinics/:id/type-preview': clinicRoute(preview),
  'GET /platform/clinics/:id/settings': clinicRoute((tabs) => ok({ settings: tabs.settings })),
  'PUT /platform/clinics/:id/settings/:key/lock': clinicRoute(lock),
  'DELETE /platform/clinics/:id/settings/:key/lock': clinicRoute(unlock),
  'GET /platform/clinics/:id/support-grants': clinicRoute((tabs) => {
    settle(tabs);
    return ok({ now: new Date().toISOString(), mine: mineIn(tabs), grants: tabs.grants });
  }),
  'POST /platform/clinics/:id/support-grants': clinicRoute(openGrant),
  'POST /platform/support-grants/:id/handoff': grantAction(() => ok({ handoffUrl: handoffUrl() })),
  'POST /platform/support-grants/:id/end': grantAction((grant) => {
    Object.assign(grant, {
      endedAt: new Date().toISOString(),
      endedBy: 'admin',
      endedByName: ADMIN_NAME,
    });
    return ok(grant);
  }),
  'GET /platform/clinics/:id/usage': clinicRoute((tabs) => ok(tabs.usage)),
};
