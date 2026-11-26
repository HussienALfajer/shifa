// Admin web's signed-out screens and its second factor: sign-in (/sign-in on admin web), a super
// admin's setup link (/setup#token, purpose admin_setup) and the challenge and enrolment (/mfa).
// The same screens as clinic web's (src/auth/), opened on admin web's router for a super admin;
// their states follow clinic web's sheets, with the world of admin web.
import type { Scenario, Sheet, Step, World } from '../../scenario.ts';
import { PLAY_CODE, PLAY_PASSWORD } from '../../state.ts';
import { ADMIN_PHONE, adminSession } from '../../world-admin.ts';
import { local, ownerSession, SETUP_TOKEN } from '../../world.ts';
import { mfaChallenge, mfaEnrol } from '../mfa.ts';
import { setupLink } from '../setup.ts';
import { signIn } from '../sign-in.ts';

const signedOut = (w: World) => {
  w.session = null;
};
const pending = (w: World) => {
  w.session = adminSession({ mfa: 'pending' });
};
const none = (w: World) => {
  w.session = adminSession({ mfa: 'none' });
};

/** Clinic web's state, on admin web: the same address, answers and steps; admin web's world. */
const onAdmin =
  (world: (w: World) => void) =>
  (s: Scenario): Scenario => ({ ...s, world });

/** States of clinic web only: the phone remembered on this device (never on admin web). */
const CLINIC_ONLY = new Set(['Remembered', 'ForgetPhone']);

const PHONE = local(ADMIN_PHONE);
const LINK = `/setup#${SETUP_TOKEN}`;
const send: Step[] = [
  { fill: 'signInPhone', value: PHONE },
  { fill: 'signInPassword', value: PLAY_PASSWORD },
  { press: 'signInSubmit' },
];

export const adminSignIn: Sheet = {
  id: 'AdminSignIn',
  title: 'تسجيل الدخول',
  route: '/sign-in',
  note: 'Sign-in on admin web: the same screen as clinic web with admin web’s words, without the remembered phone; empty fields, a wrong password, sending, the keyboard warnings, the phone and address locks, no network and a server error, a person who is not a super admin, and every reason a person is sent here (`?reason=`).',
  code: ['auth/sign-in.tsx', 'auth/sign-in-notice.tsx', 'auth/auth-layout.tsx', 'auth/lock.ts'],
  unshown: signIn.unshown ?? {},
  scenarios: [
    ...signIn.scenarios.filter((s) => !CLINIC_ONLY.has(s.id)).map(onAdmin(signedOut)),
    {
      id: 'NotAdmin',
      title: 'دخول بحساب ليس مدير منصة',
      path: '/sign-in',
      // A clinic owner's right password: the server signs them in, admin web signs them out.
      world: (w) => {
        w.session = null;
        w.signInAs = ownerSession({ mfa: 'pending' });
      },
      steps: [...send, { until: 'noticeNotAdminTitle' }],
    },
    {
      id: 'ReasonNotAdmin',
      title: 'ليس مدير منصة',
      path: '/sign-in?reason=not_admin',
      world: signedOut,
    },
  ],
};

/** A super admin's link goes on to enrolment: its button reads «حفظ والمتابعة إلى التحقق». */
const save: Step = { press: 'setupSaveEnrol' };
const isEnter = (step: Step) => 'press' in step && step.press === 'setupSaveEnter';

/** The setup-link states that are a staff member's, an owner's or an invitation's link. */
const NOT_ADMIN_LINK = new Set(['Member', 'Owner', 'Admin', 'OwnerPending', 'ContainsPhone']);

export const adminSetupLink: Sheet = {
  id: 'AdminSetupLink',
  title: 'رابط الإعداد',
  route: '/setup#token',
  note: 'A super admin’s setup link on admin web: reading it, an invalid or used link, no network and a server error; the password rules while typing; every refusal of the server (empty, mismatch, too short, common, contains the phone, an account that exists) and a failed send; then enrolment of the second factor.',
  code: ['auth/setup-link.tsx', 'auth/auth-layout.tsx'],
  unshown: {
    owner_setup_pending:
      'Answered to a clinic owner’s link only (an owner whose other clinic is not set up, OD-85); a super admin’s link has no clinic.',
  },
  scenarios: [
    {
      id: 'Admin',
      title: 'رابط مدير المنصة',
      path: LINK,
      world: signedOut,
    },
    ...setupLink.scenarios
      .filter((s) => !NOT_ADMIN_LINK.has(s.id))
      .map(onAdmin(signedOut))
      .map((s) =>
        s.steps ? { ...s, steps: s.steps.map((step) => (isEnter(step) ? save : step)) } : s,
      ),
    {
      id: 'ContainsPhone',
      title: 'رفض الخادم: تحتوي رقم الهاتف',
      path: LINK,
      world: signedOut,
      steps: [
        { fill: 'setupNewPassword', value: `Shifa${PHONE.slice(-7)}x` },
        { fill: 'setupRepeatPassword', value: `Shifa${PHONE.slice(-7)}x` },
        save,
      ],
    },
    {
      id: 'Saved',
      title: 'حُفظت كلمة المرور: ربط التحقق بخطوتين',
      path: LINK,
      world: signedOut,
      steps: [
        { fill: 'setupNewPassword', value: 'Halab-Admin-24' },
        { fill: 'setupRepeatPassword', value: 'Halab-Admin-24' },
        save,
        { until: 'enrolWhyAdmin' },
      ],
    },
  ],
};

export const adminMfaChallenge: Sheet = {
  id: 'AdminMfaChallenge',
  title: 'التحقق بخطوتين · طلب الرمز',
  route: '/mfa',
  note: 'The challenge after a super admin’s password: the code from the app (greeting the person by name), a wrong code, sending, the lock after too many codes, a recovery code instead (empty, wrong), no network and a server error; a right code goes on to the clinics.',
  code: mfaChallenge.code,
  scenarios: [
    ...mfaChallenge.scenarios.map(onAdmin(pending)),
    {
      id: 'Passed',
      title: 'رمز صحيح: إلى العيادات',
      path: '/mfa',
      world: pending,
      steps: [{ fill: 'challengeTitle', value: PLAY_CODE }, { until: 'clinicsTitle' }],
    },
  ],
};

export const adminMfaEnrol: Sheet = {
  id: 'AdminMfaEnrol',
  title: 'التحقق بخطوتين · الربط',
  route: '/mfa',
  note: 'Enrolment, required of every super admin (in admin web’s words): step 1 the app, step 2 the QR code and the key (folded on a phone), step 3 the code; the key that failed to load, a wrong code, the device clock off, the lock; then the ten recovery codes, shown once.',
  code: mfaEnrol.code,
  scenarios: mfaEnrol.scenarios.map(onAdmin(none)),
};
