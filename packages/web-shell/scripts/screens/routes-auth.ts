// The fake server's routes for the person and their session: sign-in, the second factor, the
// setup link and invitation, sessions and password, the clinic chooser and switch. They answer
// as the API's contracts say (codes, statuses, bodies), from and into the board's world.
import type { SessionView } from '@shifa/contracts';
import { fail, lockFor, ok, type Reply, type Request, type RouteTable } from './server.ts';
import { PLAY_CODE, PLAY_PASSWORD, type World } from './state.ts';
import { id, OTPAUTH, recoveryCodes, TOTP_KEY } from './world.ts';

const MINUTE = 60_000;
const field = (body: unknown, name: string): unknown =>
  (body as Record<string, unknown> | undefined)?.[name];
const text = (body: unknown, name: string): string => {
  const value = field(body, name);
  return typeof value === 'string' ? value : '';
};

let rotation = 60;
/** The same session under a new id, as the server rotates it (second factor, new password). */
function rotated(session: SessionView, over: Partial<SessionView> = {}): SessionView {
  rotation += 1;
  return { ...session, sessionId: id(rotation), ...over };
}

function signedIn(world: World, run: (session: SessionView) => Reply): Reply {
  return world.session ? run(world.session) : fail(401, 'unauthorized');
}

const PASSWORD_RULES = (password: string, phone: string): Reply | null => {
  if (password.length < 10) return fail(400, 'password_too_short');
  if (/^(?:1234567890|password1234|qwertyuiop)$/i.test(password))
    return fail(400, 'password_common');
  if (password.includes(phone.slice(-7))) return fail(400, 'password_contains_phone');
  return null;
};

function challenge({ body }: Request, world: World): Reply {
  return signedIn(world, (session) => {
    if (session.mfa !== 'pending') return fail(409, 'mfa_not_owed');
    const code = text(body, 'code').trim().toUpperCase();
    const recovery = field(body, 'method') === 'recovery';
    const index = world.codes.indexOf(code);
    if (recovery ? index === -1 : code !== PLAY_CODE) return fail(400, 'invalid_code');
    if (recovery) world.codes.splice(index, 1);
    world.session = rotated(session, { mfa: 'verified' });
    return ok({ session: world.session, recoveryCodesLeft: world.codes.length });
  });
}

function enrolConfirm({ body }: Request, world: World): Reply {
  return signedIn(world, (session) => {
    if (session.mfa !== 'none') return fail(409, 'mfa_already_enrolled');
    if (!world.enrolStarted) return fail(409, 'mfa_not_started');
    if (text(body, 'code') !== PLAY_CODE) return fail(400, 'invalid_code');
    world.codes = recoveryCodes();
    world.enrolStarted = false;
    world.mfa = { enrolled: true, enrolledAt: new Date().toISOString(), recoveryCodesLeft: 10 };
    world.session = rotated(session, { mfa: 'verified' });
    return ok({ recoveryCodes: world.codes, session: world.session });
  });
}

function consume({ body }: Request, world: World): Reply {
  const password = text(body, 'password');
  const rule = PASSWORD_RULES(password, world.profile.phoneE164);
  if (rule) return rule;
  const owner = world.setupView.purpose === 'owner_setup';
  world.session = rotated(world.signInAs, {
    mfa: 'none',
    // Owners and super admins owe the second factor (A-01a); a staff member does not.
    mfaRequired: owner || world.setupView.purpose === 'admin_setup',
    tenantId: owner ? (world.clinics[0]?.tenantId ?? null) : null,
  });
  return ok(world.session);
}

function switchTo({ body }: Request, world: World): Reply {
  return signedIn(world, (session) => {
    const clinic = world.clinics.find((c) => c.tenantId === field(body, 'tenantId'));
    if (!clinic) return fail(404, 'not_found');
    if (!clinic.selectable) return fail(403, 'clinic_suspended');
    const asked = field(body, 'branchId');
    const branchId = typeof asked === 'string' ? asked : null;
    if (!clinic.tenantWide && clinic.branches.length > 1 && branchId === null) {
      return fail(400, 'branch_required');
    }
    if (branchId !== null && !clinic.branches.some((b) => b.id === branchId)) {
      return fail(403, 'branch_not_held');
    }
    const branch = branchId ?? (clinic.tenantWide ? null : (clinic.branches[0]?.id ?? null));
    world.session = rotated(session, {
      tenantId: clinic.tenantId,
      branchId: branch,
      roles: clinic.roles.map((role) => ({
        role,
        tenantId: clinic.tenantId,
        branchId: clinic.tenantWide ? null : branch,
      })),
    });
    clinic.lastActiveAt = new Date().toISOString();
    return ok({ tenantId: clinic.tenantId, branchId: branch });
  });
}

export const authRoutes: RouteTable = {
  'GET /auth/session': (_r, world) => signedIn(world, (session) => ok(session)),
  'POST /auth/sign-in': ({ body }, world) => {
    if (text(body, 'password') === PLAY_PASSWORD) {
      world.wrongPasswords = 0;
      world.session = rotated(world.signInAs);
      return ok(world.session);
    }
    world.wrongPasswords += 1;
    if (world.wrongPasswords >= 5) return lockFor('phone_locked', 15 * MINUTE);
    return fail(401, 'invalid_credentials');
  },
  'POST /auth/sign-out': (_r, world) => {
    world.session = null;
    return ok(undefined, 204);
  },
  'GET /me': (_r, world) => signedIn(world, () => ok(world.profile)),
  'GET /auth/sessions': (_r, world) => signedIn(world, () => ok({ sessions: world.sessions })),
  'DELETE /auth/sessions/:id': (request, world) =>
    signedIn(world, () => {
      world.sessions = world.sessions.filter((s) => s.current || s.id !== request.id);
      return ok(undefined, 204);
    }),
  'POST /auth/sessions/end-others': (_r, world) =>
    signedIn(world, () => {
      const ended = world.sessions.filter((s) => !s.current).length;
      world.sessions = world.sessions.filter((s) => s.current);
      return ok({ ended });
    }),
  'POST /auth/password': ({ body }, world) =>
    signedIn(world, (session) => {
      if (text(body, 'currentPassword') !== PLAY_PASSWORD) return fail(401, 'invalid_credentials');
      const next = text(body, 'newPassword');
      if (next === PLAY_PASSWORD) return fail(400, 'password_unchanged');
      const rule = PASSWORD_RULES(next, world.profile.phoneE164);
      if (rule) return rule;
      world.sessions = world.sessions.filter((s) => s.current);
      world.session = rotated(session);
      return ok(world.session);
    }),
  'POST /auth/setup-link/view': (_r, world) => ok(world.setupView),
  'POST /auth/setup-link/consume': consume,
  'POST /auth/mfa/enrol/start': (_r, world) =>
    signedIn(world, (session) => {
      if (session.mfa !== 'none') return fail(409, 'mfa_already_enrolled');
      world.enrolStarted = true;
      return ok({ otpauthUri: OTPAUTH, manualKey: TOTP_KEY });
    }),
  'POST /auth/mfa/enrol/confirm': enrolConfirm,
  'POST /auth/mfa/challenge': challenge,
  'GET /auth/mfa': (_r, world) => signedIn(world, () => ok(world.mfa)),
  'POST /auth/mfa/recovery-codes': ({ body }, world) =>
    signedIn(world, () => {
      if (text(body, 'code') !== PLAY_CODE) return fail(400, 'invalid_code');
      world.codes = recoveryCodes();
      world.mfa = { ...world.mfa, recoveryCodesLeft: 10 };
      return ok({ recoveryCodes: world.codes });
    }),
  'POST /auth/mfa/re-enrol/start': ({ body }, world) =>
    signedIn(world, () => {
      if (text(body, 'code') !== PLAY_CODE) return fail(400, 'invalid_code');
      world.enrolStarted = true;
      return ok({ otpauthUri: OTPAUTH, manualKey: TOTP_KEY });
    }),
  'POST /auth/mfa/re-enrol/confirm': ({ body }, world) =>
    signedIn(world, () => {
      if (!world.enrolStarted) return fail(409, 'mfa_not_started');
      if (text(body, 'code') !== PLAY_CODE) return fail(400, 'invalid_code');
      world.enrolStarted = false;
      world.codes = recoveryCodes();
      world.mfa = { enrolled: true, enrolledAt: new Date().toISOString(), recoveryCodesLeft: 10 };
      return ok({ recoveryCodes: world.codes });
    }),
  'POST /invitations/view': (_r, world) => ok(world.invitationView),
  'POST /invitations/accept': (_r, world) =>
    signedIn(world, () => {
      world.invitations = [];
      // The clinic joins the person's clinics: «افتح العيادة» finds it there by its name.
      world.clinics.push({
        tenantId: id(19),
        name: world.invitationView.clinicName,
        status: 'active',
        selectable: true,
        roles: world.invitationView.roles.map((r) => r.role),
        tenantWide: false,
        lastActiveAt: null,
        solo: false,
        branches: world.invitationView.roles.map((r, i) => ({
          id: id(90 + i),
          name: r.branchName ?? '',
        })),
      });
      return ok(undefined, 204);
    }),
  'POST /invitations/decline': (_r, world) =>
    signedIn(world, () => {
      world.invitations = [];
      return ok(undefined, 204);
    }),
  'GET /me/clinics': (_r, world) =>
    signedIn(world, () =>
      world.clinics.length === 0 && world.invitations.length === 0
        ? fail(404, 'no_clinic')
        : ok({ clinics: world.clinics, invitations: world.invitations }),
    ),
  'POST /me/switch': switchTo,
};
