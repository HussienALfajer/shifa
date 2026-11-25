// Sign-in (/sign-in, A-01-07): every state src/auth/sign-in.tsx and sign-in-notice.tsx draw.
import type { Scenario, Sheet, Step } from '../scenario.ts';
import { fail, lockFor } from '../server.ts';
import { local, NEW_PHONE, OWNER_PHONE } from '../world.ts';

const signedOut = (w: { session: unknown }) => {
  w.session = null;
};
const PHONE = local(OWNER_PHONE);
const typed: Step[] = [
  { fill: 'signInPhone', value: PHONE },
  { fill: 'signInPassword', value: 'Shifa-2025' },
];
const send: Step[] = [...typed, { press: 'signInSubmit' }];
const MINUTE = 60_000;

const reason = (id: string, title: string, query: string): Scenario => ({
  id,
  title,
  path: `/sign-in?${query}`,
  world: signedOut,
});

export const signIn: Sheet = {
  id: 'SignIn',
  title: 'تسجيل الدخول',
  route: '/sign-in',
  note: 'Sign-in: empty and remembered phone, empty fields, wrong password, sending, the keyboard warnings, the phone and address locks with their countdown, no network and a server error, and every reason a person is sent here (`?reason=`).',
  code: [
    'auth/sign-in.tsx',
    'auth/sign-in-notice.tsx',
    'auth/auth-layout.tsx',
    'auth/lock.ts',
    'auth/remembered-phone.ts',
  ],
  scenarios: [
    { id: 'Empty', title: 'فارغة', path: '/sign-in', world: signedOut, phone: true },
    {
      id: 'Remembered',
      title: 'رقم محفوظ على هذا الجهاز',
      path: '/sign-in',
      world: signedOut,
      storage: {
        'shifa.signIn.phone': local(NEW_PHONE),
        'shifa.signIn.phoneAt': String(Date.now()),
      },
      phone: true,
    },
    {
      id: 'Missing',
      title: 'حقلان فارغان عند الإرسال',
      path: '/sign-in',
      world: signedOut,
      steps: [{ press: 'signInSubmit' }],
    },
    {
      id: 'Wrong',
      title: 'رقم أو كلمة مرور خاطئة',
      path: '/sign-in',
      world: signedOut,
      steps: send,
      phone: true,
    },
    {
      id: 'Sending',
      title: 'جارٍ الدخول',
      path: '/sign-in',
      world: signedOut,
      answers: { 'POST /auth/sign-in': 'hold' },
      steps: send,
    },
    {
      id: 'CapsLock',
      title: 'تنبيه: الأحرف الكبيرة مفعّلة',
      path: '/sign-in',
      world: signedOut,
      steps: [...typed, { key: 'S', on: 'input[autocomplete="current-password"]' }],
    },
    {
      id: 'ArabicLetters',
      title: 'تنبيه: لوحة المفاتيح عربية',
      path: '/sign-in',
      world: signedOut,
      steps: [
        { fill: 'signInPhone', value: PHONE },
        { fill: 'signInPassword', value: 'شفاء٢٠٢٦' },
      ],
    },
    {
      id: 'PhoneLocked',
      title: 'الرقم مقفل مؤقتًا (عدّ تنازلي)',
      path: '/sign-in',
      world: signedOut,
      answers: { 'POST /auth/sign-in': () => lockFor('phone_locked', 14 * MINUTE + 32_000) },
      steps: send,
      phone: true,
    },
    {
      id: 'IpBlocked',
      title: 'عنوان الشبكة محظور مؤقتًا',
      path: '/sign-in',
      world: signedOut,
      answers: { 'POST /auth/sign-in': () => lockFor('ip_blocked', 58 * MINUTE) },
      steps: send,
    },
    {
      id: 'Offline',
      title: 'لا اتصال بالخادم',
      path: '/sign-in',
      world: signedOut,
      answers: { 'POST /auth/sign-in': ['offline'] },
      steps: send,
    },
    {
      id: 'ServerError',
      title: 'خطأ في الخادم',
      path: '/sign-in',
      world: signedOut,
      answers: { 'POST /auth/sign-in': [fail(500, 'internal_error')] },
      steps: send,
    },
    reason('ReasonIdle', 'خرجت لعدم النشاط (15 دقيقة)', 'reason=idle&minutes=15'),
    reason('ReasonIdleServer', 'خرجت لعدم النشاط (من الخادم)', 'reason=idle'),
    reason('ReasonAbsolute', 'انتهت الساعات الاثنتا عشرة', 'reason=absolute'),
    reason('ReasonEnded', 'انتهت الجلسة من مكان آخر', 'reason=ended'),
    reason('ReasonExpired', 'انتهت الجلسة', 'reason=session_expired'),
    reason('ReasonSignedOut', 'خرجت بنجاح', 'reason=signed_out'),
    reason('ReasonSignOutFailed', 'ربما لم يكتمل الخروج', 'reason=sign_out_failed'),
  ],
};
