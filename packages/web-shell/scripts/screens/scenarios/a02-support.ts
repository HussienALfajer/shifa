// A super admin's support session on clinic web (A-02-10; A-02-05, ADR-0050; approved board
// `A02cSupportSession`): the hand-off at /support#<token> (opening, opened, a used or old link, no
// token, a failure), the solid support banner above every page with the clinic, the reason and the
// time left, every page read as its owner sees it with each write disabled «للقراءة فقط», a write
// the server refused (403 `support_read_only`), «إنهاء» asked first, and «انتهى دخول الدعم» with
// how it ended: by this tab, by the owner, at its expiry or by another super admin.

import { HANDOFF_TOKEN, supportEnded } from '../routes-a02-clinic.ts';
import type { Scenario, Sheet, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { DOCTOR, profile } from '../world.ts';
import { ANNOUNCEMENTS, SUPPORT_ADMIN, supportSession } from '../world-a02-clinic.ts';

/** The super admin reads the clinic, `minutesLeft` before the grant runs out. */
const reading =
  (minutesLeft = 42) =>
  (w: World) => {
    w.session = supportSession(minutesLeft);
    w.profile = { ...w.profile, userId: w.session.userId, name: SUPPORT_ADMIN };
  };
const support = (s: Omit<Scenario, 'path'> & { path?: string }): Scenario => ({
  path: '/',
  world: reading(),
  ...s,
});
const signedOut = (w: World) => {
  w.session = null;
};
const handoff = (s: Omit<Scenario, 'path' | 'world'>): Scenario => ({
  path: `/support#${HANDOFF_TOKEN}`,
  world: signedOut,
  ...s,
});
const DIALOG = '[role="alertdialog"]';
const HANDOFF = 'POST /auth/support/session';
const OWNER = profile().name;

export const supportSessionSheet: Sheet = {
  id: 'SupportSession',
  title: 'دخول الدعم · للقراءة فقط',
  route: '/support#token · /support/ended',
  note: 'A super admin reading the clinic from admin web’s «فتح دخول الدعم»: the hand-off (opening, opened, a link already used or older than two minutes, no token, a failure); the solid support banner above every page (the clinic, the reason, until when and the minutes left, ending soon), the clinic named without a switcher and no «حسابي»; the team, its drawer, the branches and the settings as the owner sees them with every write disabled «للقراءة فقط» («الاشتراك» and the log hidden); a write the server refused; «إنهاء» asked first; «انتهى دخول الدعم» ended here, by the owner, at its expiry or by another super admin, and «العودة إلى إدارة شفاء» in a tab the browser will not close.',
  code: [
    'support/support-banner.tsx',
    'support/handoff-page.tsx',
    'support/ended-page.tsx',
    'support/state.ts',
    'support/time-left.ts',
  ],
  unshown: {
    support_ended:
      'Named here as the `reason` of a 401 `session_expired` (states EndedOwner, EndedExpiry, EndedAdmin), not an error code of its own; the 409 `support_ended` is the owner’s (OwnerSupport sheet).',
  },
  scenarios: [
    handoff({ id: 'Opening', title: 'فتح دخول الدعم', answers: { [HANDOFF]: 'hold' } }),
    handoff({ id: 'Opened', title: 'فُتح: العيادة كما يراها مالكها' }),
    handoff({
      id: 'LinkInvalid',
      title: 'رابط مستعمل أو أقدم من دقيقتين',
      answers: { [HANDOFF]: fail(404, 'link_invalid') },
      steps: [{ until: 'supportSessionEndedTitle' }],
    }),
    { id: 'NoToken', title: 'عنوان بلا رمز', path: '/support', world: signedOut },
    handoff({
      id: 'OpenFailed',
      title: 'تعذّر فتح دخول الدعم',
      answers: { [HANDOFF]: fail(500, 'internal_error') },
      steps: [{ until: 'supportOpenFailed' }],
    }),
    support({ id: 'Home', title: 'شريط دخول الدعم فوق كل صفحة' }),
    support({ id: 'EndingSoon', title: 'تبقّت 4 دقائق', world: reading(4) }),
    support({
      id: 'PhoneMenu',
      title: 'التنقل على الهاتف: بلا «حسابي»',
      phone: 'only',
      steps: [{ press: 'navMenu' }],
    }),
    support({ id: 'Team', title: 'الفريق للقراءة فقط', path: '/team' }),
    support({
      id: 'Member',
      title: 'درج عضو: كل الإجراءات معطّلة',
      path: '/team',
      overlay: true,
      steps: [{ pressText: DOCTOR.name }, { until: 'memberAccount' }],
    }),
    support({ id: 'Branches', title: 'الفروع للقراءة فقط', path: '/branches' }),
    support({ id: 'Settings', title: 'الإعدادات للقراءة فقط', path: '/settings' }),
    support({
      id: 'WriteRefused',
      title: 'طلب كتابة رفضه الخادم',
      world: (w) => {
        reading()(w);
        w.clinicA02.announcements = [{ ...ANNOUNCEMENTS.places }];
      },
      steps: [{ press: 'annHide' }, { until: 'readOnlyRefusedText' }],
    }),
    support({
      id: 'EndAsk',
      title: 'إنهاء دخول الدعم: سؤال',
      overlay: true,
      steps: [{ press: 'supportEndShort' }, { until: 'supportEndAskTitle' }],
    }),
    support({
      id: 'EndedSelf',
      title: 'انتهى: أنهيته من هذا التبويب',
      steps: [
        { press: 'supportEndShort' },
        { press: 'supportEndAction', within: DIALOG },
        { until: 'supportSessionEndedTitle' },
      ],
    }),
    support({
      id: 'EndedOwner',
      title: 'انتهى: أنهاه المالك',
      path: '/team',
      answers: { 'GET /team/members': supportEnded('owner', OWNER) },
      steps: [{ until: 'supportSessionEndedTitle' }],
    }),
    support({
      id: 'EndedExpiry',
      title: 'انتهى: انقضت المدة',
      path: '/team',
      answers: { 'GET /team/members': supportEnded('expiry', null, 0) },
      steps: [{ until: 'supportSessionEndedTitle' }],
    }),
    support({
      id: 'EndedAdmin',
      title: 'انتهى: أنهاه مدير منصة',
      path: '/team',
      answers: { 'GET /team/members': supportEnded('admin') },
      steps: [{ until: 'supportSessionEndedTitle' }],
    }),
    support({
      id: 'EndedTabOpen',
      title: 'انتهى: التبويب لم يُغلق',
      steps: [
        { press: 'supportEndShort' },
        { press: 'supportEndAction', within: DIALOG },
        { press: 'supportBackToAdmin' },
        { until: 'supportCloseTab' },
      ],
    }),
  ],
};
