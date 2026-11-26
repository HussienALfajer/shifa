// What admin web shows over or beside its pages: the idle warning (idle-dialog.tsx) over the
// clinics, «خروج» from the frame, and the shell's remaining pages (about, an address that does
// not exist) on admin web's router.
import type { Sheet } from '../../scenario.ts';

const MINUTE = 60_000;

export const adminOtherSheet: Sheet = {
  id: 'AdminOther',
  title: 'عدم النشاط والخروج وصفحات أخرى',
  route: '/ · /about · *',
  note: 'The idle warning over the clinics (its countdown, and «متابعة العمل» that found no network), «خروج» from the frame back to sign-in, and the shell’s remaining pages on admin web, still the A-01-06 placeholders: about, signed in and signed out, and an address that does not exist.',
  code: ['idle-dialog.tsx', 'use-idle.tsx', 'pages.tsx'],
  scenarios: [
    {
      id: 'IdleWarning',
      title: 'تنبيه عدم النشاط (عدّ تنازلي)',
      path: '/',
      overlay: true,
      steps: [{ wait: 600 }, { advance: 14 * MINUTE + 15_000 }, { until: 'idleTitle' }],
    },
    {
      id: 'IdleContinueFailed',
      title: 'تنبيه عدم النشاط: تعذّرت المتابعة',
      path: '/',
      overlay: true,
      answers: {
        'GET /auth/session': (_r, w) =>
          w.session && Date.parse(w.session.idleExpiresAt) - Date.now() < 90_000
            ? 'offline'
            : { status: 200, body: w.session },
      },
      steps: [
        { wait: 600 },
        { advance: 14 * MINUTE + 15_000 },
        { until: 'idleTitle' },
        { press: 'idleContinue' },
        { until: 'idleContinueFailed' },
      ],
    },
    {
      id: 'SignedOut',
      title: '«خروج»: إلى تسجيل الدخول',
      path: '/',
      steps: [{ press: 'signOutShort' }, { until: 'noticeSignedOutTitle' }],
    },
    { id: 'About', title: 'حول التطبيق', path: '/about' },
    {
      id: 'AboutSignedOut',
      title: 'حول التطبيق دون تسجيل دخول',
      path: '/about',
      world: (w) => {
        w.session = null;
      },
    },
    { id: 'NotFound', title: 'عنوان غير موجود', path: '/no-such-page' },
  ],
};
