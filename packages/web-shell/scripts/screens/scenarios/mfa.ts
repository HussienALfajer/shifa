// The second factor (/mfa, A-01-07): the challenge (src/auth/mfa-challenge.tsx), enrolment in
// three steps (mfa-enrol.tsx) and the recovery codes shown once (recovery-codes.tsx).
import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { fail, lockFor } from '../server.ts';
import { PLAY_CODE } from '../state.ts';
import { ownerSession } from '../world.ts';

const MINUTE = 60_000;
const pending = (w: World) => {
  w.session = ownerSession({ mfa: 'pending' });
};
const none = (w: World) => {
  w.session = ownerSession({ mfa: 'none', tenantId: null, branchId: null, roles: [] });
};
const challenge = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/mfa', world: pending, ...s });
const enrol = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/mfa', world: none, ...s });
const code = (value: string): Step => ({ fill: 'challengeTitle', value });
const recovery: Step = { press: 'challengeUseRecovery' };
const toKey: Step = { press: 'enrolHaveApp' };
// «أضفتُ الحساب» stays off until the key has loaded; pressing waits for it.
const toCode: Step[] = [toKey, { press: 'enrolAdded' }];
const enrolCode = (value: string): Step => ({ fill: 'enrolCodeLabel', value });

export const mfaChallenge: Sheet = {
  id: 'MfaChallenge',
  title: 'التحقق بخطوتين · طلب الرمز',
  route: '/mfa',
  note: 'The challenge after the password: the code from the app (greeting the person by name), a wrong code, sending, the lock after too many codes, a recovery code instead (empty, wrong), no network and a server error.',
  code: ['auth/mfa.tsx', 'auth/mfa-challenge.tsx', 'auth/me.ts', 'auth/lock.ts'],
  scenarios: [
    challenge({ id: 'Code', title: 'رمز التطبيق' }),
    challenge({ id: 'Wrong', title: 'رمز خاطئ', steps: [code('654321')] }),
    challenge({
      id: 'Sending',
      title: 'جارٍ التحقق',
      answers: { 'POST /auth/mfa/challenge': 'hold' },
      steps: [code(PLAY_CODE)],
    }),
    challenge({
      id: 'Locked',
      title: 'إيقاف مؤقت بعد محاولات كثيرة',
      answers: { 'POST /auth/mfa/challenge': () => lockFor('mfa_locked', 9 * MINUTE + 40_000) },
      steps: [code('654321')],
    }),
    challenge({ id: 'Recovery', title: 'رمز استرداد بدل التطبيق', steps: [recovery] }),
    challenge({
      id: 'RecoveryEmpty',
      title: 'رمز استرداد فارغ',
      steps: [recovery, { press: 'confirm' }],
    }),
    challenge({
      id: 'RecoveryWrong',
      title: 'رمز استرداد خاطئ',
      steps: [
        recovery,
        { fill: 'challengeRecoveryLabel', value: '00000-11111' },
        { press: 'confirm' },
      ],
    }),
    challenge({
      id: 'Offline',
      title: 'لا اتصال بالخادم',
      answers: { 'POST /auth/mfa/challenge': ['offline'] },
      steps: [code(PLAY_CODE)],
    }),
    challenge({
      id: 'ServerError',
      title: 'خطأ في الخادم',
      answers: { 'POST /auth/mfa/challenge': [fail(500, 'internal_error')] },
      steps: [code(PLAY_CODE)],
    }),
  ],
};

export const mfaEnrol: Sheet = {
  id: 'MfaEnrol',
  title: 'التحقق بخطوتين · الربط',
  route: '/mfa',
  note: 'Enrolment, required of owners: step 1 the app, step 2 the QR code and the key (folded on a phone), step 3 the code; the key that failed to load, a wrong code, the device clock off, the lock; then the ten recovery codes, shown once, to copy or print, and the box that lets the person go on.',
  code: ['auth/mfa.tsx', 'auth/mfa-enrol.tsx', 'auth/recovery-codes.tsx'],
  scenarios: [
    enrol({ id: 'App', title: 'الخطوة 1: تطبيق المصادقة' }),
    enrol({
      id: 'KeyLoading',
      title: 'الخطوة 2: تحضير المفتاح',
      answers: { 'POST /auth/mfa/enrol/start': 'hold' },
      steps: [toKey],
    }),
    enrol({
      id: 'Key',
      title: 'الخطوة 2: رمز QR والمفتاح',
      steps: [toKey, { wait: 900 }],
    }),
    enrol({
      id: 'KeyFailed',
      title: 'الخطوة 2: تعذّر تحضير المفتاح',
      answers: { 'POST /auth/mfa/enrol/start': [fail(500, 'internal_error')] },
      steps: [toKey, { until: 'enrolStartFailedTitle' }],
    }),
    enrol({ id: 'Code', title: 'الخطوة 3: الرمز من التطبيق', steps: toCode }),
    enrol({ id: 'Wrong', title: 'الخطوة 3: رمز خاطئ', steps: [...toCode, enrolCode('654321')] }),
    enrol({
      id: 'ClockSkew',
      title: 'ساعة الجهاز غير مضبوطة',
      answers: { 'POST /auth/mfa/enrol/confirm': [fail(400, 'clock_skew')] },
      steps: [...toCode, enrolCode('654321')],
    }),
    enrol({
      id: 'Locked',
      title: 'إيقاف مؤقت بعد محاولات كثيرة',
      answers: { 'POST /auth/mfa/enrol/confirm': () => lockFor('mfa_locked', 9 * MINUTE + 40_000) },
      steps: [...toCode, enrolCode('654321')],
    }),
    enrol({
      id: 'Codes',
      title: 'رموز الاسترداد (تُعرض مرة واحدة)',
      steps: [...toCode, enrolCode(PLAY_CODE), { until: 'codesTitle' }],
    }),
    enrol({
      id: 'CodesSaved',
      title: 'رموز الاسترداد: حفظتها',
      steps: [
        ...toCode,
        enrolCode(PLAY_CODE),
        { until: 'codesTitle' },
        { click: '[role="checkbox"]' },
      ],
    }),
  ],
};
