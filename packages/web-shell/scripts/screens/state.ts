// The mutable world of one board: what the fake server answers from and changes in Play.
import type {
  Branch,
  ClinicSettings,
  InvitationView,
  MemberDetail,
  MfaStatus,
  MyClinic,
  MyInvitation,
  MyProfile,
  SessionSummary,
  SessionView,
  SetupLinkView,
} from '@shifa/contracts';
import * as w from './world.ts';
import {
  ADMIN_NAME,
  ADMIN_PHONE,
  adminProfile,
  adminSession,
  type PlatformClinic,
  platformClinics,
} from './world-admin.ts';

export interface World {
  /** The browser's session; null when signed out. */
  session: SessionView | null;
  /** What a right password signs in to (the second factor still owed). */
  signInAs: SessionView;
  profile: MyProfile;
  clinics: MyClinic[];
  invitations: MyInvitation[];
  members: MemberDetail[];
  branches: Branch[];
  settings: ClinicSettings;
  mfa: MfaStatus;
  sessions: SessionSummary[];
  /** The unused recovery codes (any one passes the challenge once). */
  codes: string[];
  setupView: SetupLinkView;
  invitationView: InvitationView;
  /** Wrong sign-in passwords in a row; the fifth locks the phone. */
  wrongPasswords: number;
  /** Set by an enrolment or a move of TOTP once started. */
  enrolStarted: boolean;
  /** Admin web: the platform's clinics and their owners (world-admin.ts). */
  platform: PlatformClinic[];
}

/** Which app a board runs: clinic web or admin web (the same shell, another router). */
export type ScreensApp = 'clinic' | 'admin';

/** Admin web's world: a super admin signed in (or signing in), the platform's clinics. */
export function createAdminWorld(): World {
  return createWorld({
    session: adminSession(),
    signInAs: adminSession({ mfa: 'pending' }),
    profile: adminProfile(),
    clinics: [],
    invitations: [],
    setupView: {
      clinicName: null,
      personName: ADMIN_NAME,
      role: 'platform_admin',
      purpose: 'admin_setup',
      phoneMasked: w.masked(ADMIN_PHONE),
      expiresAt: w.at(2 * 86_400_000),
    },
  });
}

/** The right password and code in Play (written in the canvas notes). */
export const PLAY_PASSWORD = 'Shifa-2026';
export const PLAY_CODE = '123456';

export function createWorld(over: Partial<World> = {}): World {
  const codes = w.recoveryCodes();
  return {
    session: w.ownerSession(),
    signInAs: w.ownerSession({
      mfa: 'pending',
      tenantId: null,
      branchId: null,
      roles: [],
    }),
    profile: w.profile(),
    clinics: w.myClinics(),
    invitations: w.myInvitations(),
    members: w.members(),
    branches: w.branches(),
    settings: { idleMinutes: 15 },
    mfa: w.mfaStatus(),
    sessions: w.sessions(),
    codes,
    setupView: {
      clinicName: w.CLINIC,
      personName: w.NEW_PERSON,
      role: 'doctor',
      purpose: 'member_setup',
      phoneMasked: w.masked(w.NEW_PHONE),
      expiresAt: w.at(2 * 86_400_000),
    },
    invitationView: {
      clinicName: w.INVITING_CLINIC,
      personName: w.OWNER_NAME,
      roles: [
        { role: 'doctor', branchName: 'الفرع الرئيسي' },
        { role: 'doctor', branchName: 'فرع الحمدانية' },
      ],
      expiresAt: w.at(5 * 86_400_000),
      phoneMasked: w.masked(w.OWNER_PHONE),
    },
    wrongPasswords: 0,
    enrolStarted: false,
    platform: platformClinics(),
    ...over,
  };
}
