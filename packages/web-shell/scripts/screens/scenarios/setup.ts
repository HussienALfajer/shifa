// The setup link (/setup#token, A-01-07) and the invitation it may carry (A-01-08): every state of
// src/auth/setup-link.tsx and src/auth/invitation.tsx.
import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { local, NEW_PHONE, ownerSession, SETUP_TOKEN } from '../world.ts';

const LINK = `/setup#${SETUP_TOKEN}`;
const signedOut = (w: World) => {
  w.session = null;
};
const owner = (w: World) => {
  w.session = null;
  w.setupView = { ...w.setupView, role: 'owner', purpose: 'owner_setup' };
};
const both = (password: string, repeat = password): Step[] => [
  { fill: 'setupNewPassword', value: password },
  { fill: 'setupRepeatPassword', value: repeat },
];
const save: Step = { press: 'setupSaveEnter' };
const GOOD = 'Halab-Clinic-24';

const setupState = (s: Omit<Scenario, 'path'> & { path?: string }): Scenario => ({
  path: LINK,
  world: signedOut,
  ...s,
});

export const setupLink: Sheet = {
  id: 'SetupLink',
  title: 'رابط الإعداد',
  route: '/setup#token',
  note: 'The setup link: reading it, an invalid or used link, no network and a server error; a member’s and an owner’s link; the password rules while typing; every refusal of the server (empty, mismatch, too short, common, contains the phone, owner not set up yet, an account that exists) and a failed send.',
  code: ['auth/setup-link.tsx', 'auth/auth-layout.tsx'],
  scenarios: [
    setupState({
      id: 'Reading',
      title: 'قراءة الرابط',
      answers: { 'POST /auth/setup-link/view': 'hold' },
    }),
    setupState({
      id: 'Invalid',
      title: 'رابط غير صالح أو مستخدم',
      answers: { 'POST /auth/setup-link/view': fail(404, 'link_invalid') },
      phone: true,
    }),
    setupState({ id: 'NoToken', title: 'فُتح دون رمز', path: '/setup' }),
    setupState({
      id: 'Offline',
      title: 'لا اتصال بالخادم',
      answers: { 'POST /auth/setup-link/view': 'offline' },
    }),
    setupState({
      id: 'ServerError',
      title: 'خطأ في الخادم',
      answers: { 'POST /auth/setup-link/view': fail(500, 'internal_error') },
    }),
    setupState({ id: 'Member', title: 'رابط موظف (طبيب)', phone: true }),
    setupState({
      id: 'Owner',
      title: 'رابط مالك العيادة (يتبعه التحقق بخطوتين)',
      world: owner,
      phone: true,
    }),
    setupState({
      id: 'Typing',
      title: 'قاعدة الطول محققة أثناء الكتابة',
      steps: [{ fill: 'setupNewPassword', value: GOOD }],
    }),
    setupState({ id: 'Empty', title: 'حفظ دون كلمة مرور', steps: [save] }),
    setupState({
      id: 'Mismatch',
      title: 'التكرار لا يطابق',
      steps: [...both(GOOD, 'Halab-Clinic-25'), save],
    }),
    setupState({ id: 'TooShort', title: 'رفض الخادم: قصيرة', steps: [...both('Halab-24'), save] }),
    setupState({ id: 'Common', title: 'رفض الخادم: شائعة', steps: [...both('1234567890'), save] }),
    setupState({
      id: 'ContainsPhone',
      title: 'رفض الخادم: تحتوي رقم الهاتف',
      world: (w) => {
        w.session = null;
        w.profile = { ...w.profile, phoneE164: NEW_PHONE };
      },
      steps: [...both(`Shifa${local(NEW_PHONE).slice(-7)}x`), save],
    }),
    setupState({
      id: 'OwnerPending',
      title: 'المالك لم يُكمل إعداده بعد',
      answers: { 'POST /auth/setup-link/consume': fail(409, 'owner_setup_pending') },
      steps: [...both(GOOD), save],
    }),
    setupState({
      id: 'AccountExists',
      title: 'يوجد حساب بهذا الرقم',
      answers: { 'POST /auth/setup-link/consume': fail(409, 'conflict') },
      steps: [...both(GOOD), save],
    }),
    setupState({
      id: 'Saving',
      title: 'جارٍ الحفظ',
      answers: { 'POST /auth/setup-link/consume': 'hold' },
      steps: [...both(GOOD), save],
    }),
    setupState({
      id: 'SaveOffline',
      title: 'تعذّر الإرسال: لا اتصال',
      answers: { 'POST /auth/setup-link/consume': ['offline'] },
      steps: [...both(GOOD), save],
    }),
  ],
};

const invitationLink = (w: World) => {
  w.setupView = { ...w.setupView, purpose: 'invitation' };
};
const invitedSignedIn = (w: World) => {
  invitationLink(w);
  w.session = ownerSession();
};
const invite = (s: Omit<Scenario, 'path'>): Scenario => ({
  path: LINK,
  world: invitedSignedIn,
  ...s,
});

export const invitation: Sheet = {
  id: 'Invitation',
  title: 'دعوة إلى عيادة',
  route: '/setup#token',
  note: 'An invitation to join another clinic, on its setup link: read while signed out (sign in first) or signed in; the decline question; accepted and declined; another person’s phone; reading it, an invalid link and a failed answer.',
  code: ['auth/invitation.tsx', 'auth/setup-link.tsx', 'auth/held-invitation.ts'],
  scenarios: [
    invite({ id: 'Reading', title: 'قراءة الدعوة', answers: { 'POST /invitations/view': 'hold' } }),
    invite({
      id: 'SignedOut',
      title: 'الدعوة قبل تسجيل الدخول',
      world: (w) => {
        invitationLink(w);
        w.session = null;
      },
      phone: true,
    }),
    invite({ id: 'Open', title: 'الدعوة: قبول أو رفض', phone: true }),
    invite({
      id: 'DeclineAsk',
      title: 'سؤال قبل الرفض',
      overlay: true,
      steps: [{ press: 'inviteDecline' }],
    }),
    invite({
      id: 'Accepted',
      title: 'قُبلت الدعوة',
      steps: [{ press: 'inviteAccept' }, { until: 'inviteOpen' }],
    }),
    invite({
      id: 'Declined',
      title: 'رُفضت الدعوة',
      steps: [
        { press: 'inviteDecline' },
        { press: 'inviteDeclineConfirm' },
        { until: 'inviteToClinics' },
      ],
    }),
    invite({
      id: 'OtherPhone',
      title: 'الدعوة لرقم آخر',
      answers: { 'POST /invitations/accept': fail(403, 'invitation_other_phone') },
      steps: [{ press: 'inviteAccept' }],
    }),
    invite({
      id: 'AnswerOffline',
      title: 'تعذّر إرسال الجواب',
      answers: { 'POST /invitations/accept': ['offline'] },
      steps: [{ press: 'inviteAccept' }],
    }),
    invite({
      id: 'Invalid',
      title: 'دعوة منتهية أو مستخدمة',
      answers: { 'POST /invitations/view': fail(404, 'link_invalid') },
    }),
  ],
};
