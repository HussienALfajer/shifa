// Clinic web's home in its frame (src/pages.tsx HomePage, account/app-frame.tsx) and what shows
// over any page: the idle warning (idle-dialog.tsx), the 12-hour notice, the recovery codes left
// after a recovery-code sign-in; and the remaining pages of the shell (about, admin web, not found).

import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { CODES_BADGE_BUG } from '../scenario.ts';
import { B_MAIN, ownerSession, TENANT } from '../world.ts';

const at = (ms: number) => new Date(Date.now() + ms).toISOString();
const MINUTE = 60_000;
const home = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/', ...s });

/** A recovery-code sign-in with `left` codes after it: the challenge, then home. */
function afterRecovery(left: number): Pick<Scenario, 'path' | 'world' | 'steps'> {
  const codes = Array.from(
    { length: left + 1 },
    (_, i) => `${String(40_210 + i)}-${String(83_550 + i)}`,
  );
  const steps: Step[] = [
    { press: 'challengeUseRecovery' },
    { fill: 'challengeRecoveryLabel', value: codes[0] ?? '' },
    { press: 'confirm' },
    { until: left <= 2 ? 'codesLowTitle' : 'codesLeftTitle', values: { count: left } },
  ];
  return {
    path: '/mfa',
    world: (w: World) => {
      w.session = ownerSession({ mfa: 'pending' });
      w.codes = codes;
      w.mfa = { ...w.mfa, recoveryCodesLeft: left };
    },
    steps,
  };
}

export const homeSheet: Sheet = {
  id: 'Home',
  title: 'الرئيسية والإطار',
  route: '/',
  note: 'The frame of every signed-in page (header with the switcher, the codes badge and the avatar; the navigation; on a phone behind its menu) around the home page, whose content is still the A-01-06 placeholder; for an owner, a member and a solo clinic; with the recovery codes left after a recovery-code sign-in, the 12-hour notice and the idle warning.',
  code: [
    'pages.tsx',
    'account/app-frame.tsx',
    'auth/codes-left-notice.tsx',
    'idle-dialog.tsx',
    'use-idle.tsx',
  ],
  scenarios: [
    home({ id: 'Owner', title: 'المالك' }),
    home({
      id: 'PhoneMenu',
      title: 'قائمة التنقل على الهاتف',
      steps: [{ press: 'navMenu' }],
      phone: 'only',
    }),
    home({
      id: 'Member',
      title: 'موظف (طبيب في فرع)',
      world: (w) => {
        w.session = ownerSession({
          roles: [{ role: 'doctor', tenantId: TENANT, branchId: B_MAIN.id }],
        });
        const [first, ...rest] = w.clinics;
        if (first)
          w.clinics = [
            { ...first, roles: ['doctor'], tenantWide: false, branches: [B_MAIN] },
            ...rest,
          ];
      },
    }),
    home({
      id: 'Solo',
      title: 'عيادة بفرع واحد (بلا شاشة الفروع)',
      world: (w) => {
        const [first, ...rest] = w.clinics;
        if (first) w.clinics = [{ ...first, solo: true, branches: [B_MAIN] }, ...rest];
      },
    }),
    { id: 'CodesLeft', title: 'بعد الدخول برمز استرداد: بقيت 7', ...afterRecovery(7) },
    {
      id: 'CodesLow',
      widerOnPhone: CODES_BADGE_BUG,
      title: 'بعد الدخول برمز استرداد: بقي رمزان',
      ...afterRecovery(2),
    },
    home({
      id: 'SessionEnds',
      title: 'تنتهي الساعات الاثنتا عشرة قريبًا',
      world: (w) => {
        w.session = ownerSession({ absoluteExpiresAt: at(8 * MINUTE) });
      },
    }),
    home({
      id: 'ClinicsUnread',
      title: 'تعذّر قراءة العيادات: الترويسة بلا اسم',
      answers: { 'GET /me/clinics': 'offline' },
    }),
    home({
      id: 'IdleContinueFailed',
      title: 'تنبيه عدم النشاط: تعذّرت المتابعة',
      // The session read at «متابعة العمل» finds no network (the page's first read had one).
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
      overlay: true,
    }),
    home({
      id: 'IdleWarning',
      title: 'تنبيه عدم النشاط (عدّ تنازلي)',
      // Fourteen minutes and a quarter without a key or a click, on a 15-minute clinic.
      steps: [{ wait: 600 }, { advance: 14 * MINUTE + 15_000 }, { until: 'idleTitle' }],
      overlay: true,
    }),
  ],
};

export const otherPages: Sheet = {
  id: 'OtherPages',
  title: 'صفحات أخرى',
  route: '/about · /admin-web · *',
  note: 'The shell’s remaining pages, still the A-01-06 placeholders: about (version, icon credit, theme choice), the page that sends a super admin to admin web, and an address that does not exist.',
  code: ['pages.tsx'],
  scenarios: [
    { id: 'About', title: 'حول التطبيق', path: '/about' },
    {
      id: 'AdminWeb',
      title: 'مدير المنصة على نظام العيادة',
      path: '/admin-web',
      world: (w) => {
        w.session = ownerSession({
          platformAdmin: true,
          tenantId: null,
          branchId: null,
          roles: [],
        });
      },
    },
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
