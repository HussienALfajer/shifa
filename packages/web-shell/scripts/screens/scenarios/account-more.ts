// My account's states after acting (A-01-10): sessions ended or refused, every refusal of a new
// password, the recovery codes renewed or refused, a staff member's enrolment, moving the second
// factor to a new phone and its refusals. The sheet is in account.ts.

import type { Answer, Scenario, Step, World } from '../scenario.ts';
import { CODES_BADGE_BUG } from '../scenario.ts';
import { fail, lockFor } from '../server.ts';
import { PLAY_CODE, PLAY_PASSWORD } from '../state.ts';
import { B_MAIN, local, OWNER_PHONE, ownerSession, TENANT } from '../world.ts';

const MINUTE = 60_000;
const NEXT = 'Halab-Clinic-24';
const account = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/account', ...s });
const dialog = (s: Omit<Scenario, 'path' | 'overlay'>): Scenario =>
  account({ overlay: true, ...s });
const answered = (id: string, title: string, route: string, answer: Answer, steps: Step[]) =>
  dialog({ id, title, answers: { [route]: answer }, steps });

export const staff = (w: World) => {
  w.session = ownerSession({
    mfa: 'none',
    mfaRequired: false,
    roles: [{ role: 'doctor', tenantId: TENANT, branchId: B_MAIN.id }],
  });
  w.mfa = { enrolled: false, enrolledAt: null, recoveryCodesLeft: null };
  const [first, ...rest] = w.clinics;
  if (first)
    w.clinics = [{ ...first, roles: ['doctor'], tenantWide: false, branches: [B_MAIN] }, ...rest];
};
export const pw = (current: string, next: string, repeat = next): Step[] => [
  { press: 'pwOpen' },
  { fill: 'pwCurrent', value: current },
  { fill: 'pwNew', value: next },
  { fill: 'pwRepeat', value: repeat },
  { press: 'pwSubmit' },
];
const code = (value: string): Step => ({ fill: 'enrolCodeLabel', value });
const renew: Step = { press: 'codesRenew' };
const renewWith = (value: string): Step[] => [renew, code(value)];
const endOne: Step[] = [{ press: 'devicesEnd' }, { press: 'devicesEndOneAction' }];
const staffOpen: Step[] = [{ press: 'mfaEnrolOpen' }];
const staffKey: Step[] = [...staffOpen, { until: 'codesEnrolAsk', values: { digits: 6 } }];
const oldCode = (value: string): Step[] => [
  { press: 'reenrolOpen' },
  { fill: 'reenrolOldCode', value },
];
const toNewKey: Step[] = [...oldCode(PLAY_CODE), { until: 'reenrolNewAsk', values: { digits: 6 } }];
const newCode = (value: string): Step[] => [...toNewKey, { fill: 'reenrolNewCode', value }];

export const accountMore: Scenario[] = [
  account({
    id: 'MfaLoadFailed',
    title: 'تعذّر تحميل التحقق بخطوتين',
    answers: { 'GET /auth/mfa': 'offline' },
    steps: [{ until: 'loadFailedTitle' }],
  }),
  account({
    id: 'CodesNone',
    widerOnPhone: CODES_BADGE_BUG,
    title: 'لم يبقَ رمز استرداد',
    world: (w) => {
      w.mfa = { ...w.mfa, recoveryCodesLeft: 0 };
    },
  }),
  account({ id: 'EndedOne', title: 'انتهت جلسة الجهاز', steps: endOne }),
  answered('Ending', 'جارٍ إنهاء الجلسة', 'DELETE /auth/sessions/:id', 'hold', endOne),
  account({
    id: 'EndOneGone',
    title: 'الجلسة انتهت من قبل',
    answers: { 'DELETE /auth/sessions/:id': [fail(404, 'not_found')] },
    steps: endOne,
  }),
  answered(
    'EndOthersFailed',
    'تعذّر إنهاء الجلسات الأخرى',
    'POST /auth/sessions/end-others',
    ['offline'],
    [{ press: 'devicesEndOthers' }, { press: 'devicesEndOthersAction' }],
  ),
  dialog({
    id: 'PasswordTooShort',
    title: 'رفض الخادم: قصيرة',
    steps: pw(PLAY_PASSWORD, 'Halab-24'),
  }),
  dialog({
    id: 'PasswordContainsPhone',
    title: 'رفض الخادم: تحتوي رقم الهاتف',
    steps: pw(PLAY_PASSWORD, `Shifa${local(OWNER_PHONE).slice(-7)}x`),
  }),
  dialog({
    id: 'PasswordUnchanged',
    title: 'رفض الخادم: هي نفسها الحالية',
    steps: pw(PLAY_PASSWORD, PLAY_PASSWORD),
  }),
  dialog({
    id: 'PasswordTooLong',
    title: 'كلمة مرور أطول من 128 حرفًا',
    steps: pw(PLAY_PASSWORD, `Halab-${'x'.repeat(123)}`),
  }),
  answered(
    'PasswordSending',
    'كلمة المرور: جارٍ الحفظ',
    'POST /auth/password',
    'hold',
    pw(PLAY_PASSWORD, NEXT),
  ),
  answered(
    'PasswordOffline',
    'كلمة المرور: لا اتصال',
    'POST /auth/password',
    ['offline'],
    pw(PLAY_PASSWORD, NEXT),
  ),
  answered(
    'PasswordServerError',
    'كلمة المرور: خطأ في الخادم',
    'POST /auth/password',
    [fail(500, 'internal_error')],
    pw(PLAY_PASSWORD, NEXT),
  ),
  answered(
    'CodesRenewLocked',
    'رموز جديدة: إيقاف مؤقت',
    'POST /auth/mfa/recovery-codes',
    () => lockFor('mfa_locked', 9 * MINUTE),
    renewWith('654321'),
  ),
  answered(
    'CodesRenewOffline',
    'رموز جديدة: لا اتصال',
    'POST /auth/mfa/recovery-codes',
    ['offline'],
    renewWith(PLAY_CODE),
  ),
  answered(
    'CodesRenewServerError',
    'رموز جديدة: خطأ في الخادم',
    'POST /auth/mfa/recovery-codes',
    [fail(500, 'internal_error')],
    renewWith(PLAY_CODE),
  ),
  answered(
    'CodesRenewNotEnrolled',
    'رموز جديدة: التحقق أُزيل من مكان آخر',
    'POST /auth/mfa/recovery-codes',
    [fail(409, 'mfa_not_enrolled')],
    renewWith(PLAY_CODE),
  ),
  dialog({
    id: 'CodesDone',
    title: 'رموز جديدة: حفظتها',
    steps: [...renewWith(PLAY_CODE), { until: 'codesCopy' }, { click: '[role="checkbox"]' }],
  }),
  dialog({
    id: 'StaffKeyLoading',
    title: 'موظف: تحضير المفتاح',
    world: staff,
    answers: { 'POST /auth/mfa/enrol/start': 'hold' },
    steps: staffOpen,
  }),
  dialog({
    id: 'StaffStartFailed',
    title: 'موظف: تعذّر تحضير المفتاح',
    world: staff,
    answers: { 'POST /auth/mfa/enrol/start': ['offline'] },
    steps: staffOpen,
  }),
  dialog({
    id: 'StaffAlready',
    title: 'موظف: الربط تمّ من جلسة أخرى',
    world: staff,
    answers: { 'POST /auth/mfa/enrol/start': [fail(409, 'mfa_already_enrolled')] },
    steps: staffOpen,
  }),
  dialog({
    id: 'StaffWrong',
    title: 'موظف: رمز خاطئ',
    world: staff,
    steps: [...staffKey, code('654321')],
  }),
  dialog({
    id: 'StaffSkew',
    title: 'موظف: ساعة الجهاز غير مضبوطة',
    world: staff,
    answers: { 'POST /auth/mfa/enrol/confirm': [fail(400, 'clock_skew')] },
    steps: [...staffKey, code('654321')],
  }),
  dialog({
    id: 'StaffRestart',
    title: 'موظف: انتهت جلسة الربط',
    world: staff,
    answers: { 'POST /auth/mfa/enrol/confirm': [fail(409, 'mfa_not_started')] },
    steps: [...staffKey, code(PLAY_CODE)],
  }),
  dialog({
    id: 'StaffCodes',
    title: 'موظف: رموز الاسترداد',
    world: staff,
    steps: [...staffKey, code(PLAY_CODE), { until: 'codesCopy' }],
  }),
  dialog({ id: 'MoveWrongOld', title: 'نقل التحقق: الرمز الحالي خاطئ', steps: oldCode('654321') }),
  answered(
    'MoveLocked',
    'نقل التحقق: إيقاف مؤقت',
    'POST /auth/mfa/re-enrol/start',
    () => lockFor('mfa_locked', 9 * MINUTE),
    oldCode('654321'),
  ),
  answered(
    'MoveStartOffline',
    'نقل التحقق: لا اتصال',
    'POST /auth/mfa/re-enrol/start',
    ['offline'],
    oldCode(PLAY_CODE),
  ),
  answered(
    'MoveNotEnrolled',
    'نقل التحقق: أُزيل من مكان آخر',
    'POST /auth/mfa/re-enrol/start',
    [fail(409, 'mfa_not_enrolled')],
    oldCode(PLAY_CODE),
  ),
  answered(
    'MoveWrongNew',
    'نقل التحقق: رمز الهاتف الجديد خاطئ',
    'POST /auth/mfa/re-enrol/confirm',
    [fail(400, 'invalid_code')],
    newCode('654321'),
  ),
  answered(
    'MoveSkew',
    'نقل التحقق: ساعة الهاتف الجديد غير مضبوطة',
    'POST /auth/mfa/re-enrol/confirm',
    [fail(400, 'clock_skew')],
    newCode('654321'),
  ),
  answered(
    'MoveUnknown',
    'نقل التحقق: لا يُعرف إن تمّ',
    'POST /auth/mfa/re-enrol/confirm',
    ['offline'],
    newCode(PLAY_CODE),
  ),
];
