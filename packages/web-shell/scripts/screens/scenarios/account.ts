// My account (/account, A-01-10) and the clinic's settings (/settings, the owner's idle limit):
// src/account/ — the person, their devices and sessions, the second factor (codes, a new phone,
// enrolment for staff), the password; every dialog and every answer of their routes.

import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { CODES_BADGE_BUG } from '../scenario.ts';
import { fail, lockFor } from '../server.ts';
import { PLAY_CODE, PLAY_PASSWORD } from '../state.ts';
import { B_MAIN, B_OLD } from '../world.ts';
import { accountMore, pw, staff } from './account-more.ts';

const account = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/account', ...s });
const password: Step = { press: 'pwOpen' };
const NEXT = 'Halab-Clinic-24';
const renew: Step = { press: 'codesRenew' };
const move: Step = { press: 'reenrolOpen' };
const code = (value: string): Step => ({ fill: 'enrolCodeLabel', value });
/** Moving TOTP: the code of the app in use, then the new phone's key. */
const toNewKey: Step[] = [
  move,
  { fill: 'reenrolOldCode', value: PLAY_CODE },
  { until: 'reenrolNewAsk', values: { digits: 6 } },
];
const MINUTE = 60_000;

export const accountSheet: Sheet = {
  id: 'Account',
  title: 'حسابي',
  route: '/account',
  note: 'My account: the person (name, phone), devices and sessions (this one, others, unknown device) with ending one or all others, the second factor (codes left, low, renewing them, moving it to a new phone; for staff without it, enrolling), the password with its rules and refusals; loading and failure.',
  code: [
    'account/account-page.tsx',
    'account/devices-card.tsx',
    'account/mfa-card.tsx',
    'account/password-dialog.tsx',
    'account/codes-dialog.tsx',
    'account/reenrol-dialog.tsx',
    'account/codes-once.tsx',
    'account/totp-key.tsx',
    'account/load-failed.tsx',
  ],
  scenarios: [
    account({ id: 'Owner', title: 'المالك: الجلسات والتحقق وكلمة المرور' }),
    account({
      id: 'Loading',
      title: 'تحميل الحساب',
      answers: { 'GET /me': 'hold', 'GET /auth/sessions': 'hold', 'GET /auth/mfa': 'hold' },
    }),
    account({
      id: 'LoadFailed',
      title: 'تعذّر تحميل الأجهزة',
      answers: { 'GET /auth/sessions': 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    account({
      id: 'OneDevice',
      title: 'هذا الجهاز وحده',
      world: (w) => {
        w.sessions = w.sessions.filter((s) => s.current);
      },
    }),
    account({
      id: 'CodesLow',
      widerOnPhone: CODES_BADGE_BUG,
      title: 'رمزا استرداد فقط',
      world: (w) => {
        w.mfa = { ...w.mfa, recoveryCodesLeft: 2 };
      },
    }),
    account({ id: 'Staff', title: 'موظف دون تحقق بخطوتين', world: staff }),
    account({
      id: 'EndOneAsk',
      title: 'إنهاء جلسة جهاز',
      steps: [{ press: 'devicesEnd' }],
      overlay: true,
    }),
    account({
      id: 'EndOthersAsk',
      title: 'إنهاء كل الجلسات الأخرى',
      steps: [{ press: 'devicesEndOthers' }],
      overlay: true,
    }),
    account({
      id: 'EndedOthers',
      title: 'انتهت الجلسات الأخرى',
      steps: [{ press: 'devicesEndOthers' }, { press: 'devicesEndOthersAction' }],
    }),
    account({
      id: 'EndFailed',
      title: 'تعذّر إنهاء الجلسة',
      answers: { 'DELETE /auth/sessions/:id': ['offline'] },
      steps: [{ press: 'devicesEnd' }, { press: 'devicesEndOneAction' }],
      overlay: true,
    }),
    account({
      id: 'Password',
      title: 'تغيير كلمة المرور',
      steps: [password],
      overlay: true,
    }),
    account({
      id: 'PasswordRules',
      title: 'كلمة المرور: القواعد أثناء الكتابة',
      steps: [
        password,
        { fill: 'pwCurrent', value: PLAY_PASSWORD },
        { fill: 'pwNew', value: NEXT },
      ],
      overlay: true,
    }),
    account({
      id: 'PasswordEmpty',
      title: 'كلمة المرور: حقول فارغة',
      steps: [password, { press: 'pwSubmit' }],
      overlay: true,
    }),
    account({
      id: 'PasswordWrong',
      title: 'كلمة المرور الحالية خاطئة',
      steps: pw('Wrong-Pass-1', NEXT),
      overlay: true,
    }),
    account({
      id: 'PasswordMismatch',
      title: 'التكرار لا يطابق',
      steps: pw(PLAY_PASSWORD, NEXT, `${NEXT}x`),
      overlay: true,
    }),
    account({
      id: 'PasswordCommon',
      title: 'رفض الخادم: شائعة',
      steps: pw(PLAY_PASSWORD, '1234567890'),
      overlay: true,
    }),
    account({
      id: 'PasswordLocked',
      title: 'محاولات كثيرة: إيقاف مؤقت',
      answers: { 'POST /auth/password': () => lockFor('phone_locked', 12 * MINUTE) },
      steps: pw('Wrong-Pass-1', NEXT),
      overlay: true,
    }),
    account({ id: 'PasswordDone', title: 'تغيّرت كلمة المرور', steps: pw(PLAY_PASSWORD, NEXT) }),
    account({
      id: 'CodesRenew',
      title: 'رموز جديدة: الرمز من التطبيق',
      steps: [renew],
      overlay: true,
    }),
    account({
      id: 'CodesRenewWrong',
      title: 'رموز جديدة: رمز خاطئ',
      steps: [renew, code('654321')],
      overlay: true,
    }),
    account({
      id: 'CodesRenewSkew',
      title: 'رموز جديدة: ساعة الجهاز غير مضبوطة',
      answers: { 'POST /auth/mfa/recovery-codes': [fail(400, 'clock_skew')] },
      steps: [renew, code('654321')],
      overlay: true,
    }),
    account({
      id: 'CodesNew',
      title: 'الرموز الجديدة (تُعرض مرة واحدة)',
      steps: [renew, code(PLAY_CODE), { until: 'codesCopy' }],
      overlay: true,
    }),
    account({
      id: 'Move',
      title: 'نقل التحقق إلى هاتف جديد: الرمز الحالي',
      steps: [move],
      overlay: true,
    }),
    account({
      id: 'MoveKey',
      title: 'نقل التحقق: المفتاح الجديد',
      steps: toNewKey,
      overlay: true,
    }),
    account({
      id: 'MoveRestart',
      title: 'نقل التحقق: انتهت المهلة، ابدأ من جديد',
      answers: { 'POST /auth/mfa/re-enrol/confirm': [fail(409, 'mfa_not_started')] },
      steps: [...toNewKey, { fill: 'reenrolNewCode', value: '654321' }],
      overlay: true,
    }),
    account({
      id: 'MoveDone',
      title: 'نقل التحقق: الرموز الجديدة',
      steps: [...toNewKey, { fill: 'reenrolNewCode', value: PLAY_CODE }, { until: 'codesCopy' }],
      overlay: true,
    }),
    account({
      id: 'StaffEnrol',
      title: 'موظف: ربط التحقق بخطوتين',
      world: staff,
      steps: [{ press: 'mfaEnrolOpen' }, { until: 'codesEnrolAsk', values: { digits: 6 } }],
      overlay: true,
    }),
    ...accountMore,
  ],
};

const settings = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/settings', ...s });
/** One active branch (and one archived): the clinic's solo line. */
const solo = (w: World) => {
  const [first, ...rest] = w.clinics;
  if (first) w.clinics = [{ ...first, solo: true, branches: [B_MAIN] }, ...rest];
  w.branches = w.branches.filter((b) => b.id === B_MAIN.id || b.id === B_OLD.id);
};
const pick = (minutes: number): Step => ({ check: `${String(minutes)} ` });

export const settingsSheet: Sheet = {
  id: 'Settings',
  title: 'إعدادات العيادة',
  route: '/settings',
  note: 'The owner’s clinic settings: the idle limit (15, 30 or 60 minutes; super admins keep 15), saving it and its failure; the branches card (or the solo clinic’s line); loading.',
  code: ['account/settings-page.tsx', 'branches/settings-branches.tsx'],
  scenarios: [
    settings({ id: 'Settings', title: 'مهلة عدم النشاط' }),
    settings({
      id: 'Loading',
      title: 'تحميل الإعدادات',
      answers: { 'GET /clinic/settings': 'hold' },
    }),
    settings({
      id: 'LoadFailed',
      title: 'تعذّر تحميل الإعدادات',
      answers: { 'GET /clinic/settings': 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    settings({ id: 'Changed', title: 'اختيار 30 دقيقة قبل الحفظ', steps: [pick(30)] }),
    settings({
      id: 'Saving',
      title: 'جارٍ الحفظ',
      answers: { 'PATCH /clinic/settings': 'hold' },
      steps: [pick(30), { press: 'save' }],
    }),
    settings({ id: 'Saved', title: 'حُفظت المهلة', steps: [pick(60), { press: 'save' }] }),
    settings({
      id: 'NotSaved',
      title: 'تعذّر الحفظ',
      answers: { 'PATCH /clinic/settings': ['offline'] },
      steps: [pick(30), { press: 'save' }],
    }),
    settings({
      id: 'Refused',
      title: 'الحفظ مرفوض',
      answers: { 'PATCH /clinic/settings': [fail(403, 'forbidden')] },
      steps: [pick(30), { press: 'save' }],
    }),
    settings({ id: 'Solo', title: 'عيادة بفرع واحد', world: solo }),
    settings({
      id: 'SoloAdd',
      title: 'عيادة بفرع واحد: إضافة فرع',
      world: solo,
      steps: [{ press: 'branchesAdd' }, { until: 'branchAddTitle' }],
      overlay: true,
    }),
  ],
};
