// What clinic web shows above every page from A-02-10, besides the support session's own strip
// (a02-support.ts): the owner's banner while a super admin reads the clinic (approved board
// `A02cSettings`; contract rows "owner's support banner and log" and "Owner ends support") with
// «سجل دخول الدعم» on the settings; and the announcements from Shifa (board `A02cAnnouncements`;
// contract rows "Every page · announcement banner" and "Announcement · hide").
import type { Answer, Scenario, Sheet, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { B_MAIN, ownerSession, TENANT } from '../world.ts';
import {
  ANNOUNCEMENTS,
  OTHER_SUPPORT_ADMIN,
  openGrant,
  SUPPORT_ADMIN,
  SUPPORT_REASON,
  supportSession,
} from '../world-a02-clinic.ts';

const DIALOG = '[role="alertdialog"]';
const END = 'POST /clinic/support-grants/:id/end';
const GRANTS = 'GET /clinic/support-grants';

/** A super admin reads the clinic now (and, with `two`, another one too). */
const opened =
  (two = false) =>
  (w: World) => {
    const second = openGrant(
      34,
      OTHER_SUPPORT_ADMIN,
      'التحقق من إعداد مهلة عدم النشاط بعد طلب المالك',
      18,
    );
    w.clinicA02.grants = [
      openGrant(33, SUPPORT_ADMIN, SUPPORT_REASON, 42),
      ...(two ? [second] : []),
      ...w.clinicA02.grants,
    ];
  };
const owner = (s: Omit<Scenario, 'path'> & { path?: string }): Scenario => ({
  path: '/',
  world: opened(),
  ...s,
});
const askEnd = { press: 'supportEndAction' } as const;
const confirmEnd = { press: 'supportEndAction', within: DIALOG } as const;

/** The grant ran out meanwhile: the end is refused and the next read has no banner. */
const endedMeanwhile: Answer = (request, world) => {
  const g = world.clinicA02.grants.find((x) => x.id === request.id);
  if (g) Object.assign(g, { endedAt: g.expiresAt, endedBy: 'expiry', endedByName: null });
  return fail(409, 'support_ended');
};

export const ownerSupportSheet: Sheet = {
  id: 'OwnerSupport',
  title: 'دخول الدعم: ما يراه المالك',
  route: '/ · /settings',
  note: 'The owner while a super admin reads the clinic: the warning banner above every page with who, why, until when and the minutes left (two at once, one per super admin), «إنهاء الدخول» asked first, ended (the banner gone, «أنهيت دخول الدعم»), refused because it ran out meanwhile (read again, no banner), a server error kept in the question. «سجل دخول الدعم» on the clinic’s settings: every grant, newest first, with «السبب» whole (open, ran out, ended by the owner); empty, loading, failed.',
  code: ['support/owner-support.tsx', 'admin/support-log.tsx'],
  scenarios: [
    owner({ id: 'Banner', title: 'فريق شفاء يقرأ العيادة الآن' }),
    owner({ id: 'TwoBanners', title: 'مديران يقرآن العيادة', world: opened(true) }),
    owner({ id: 'OnTeam', title: 'الشريط فوق صفحة الفريق', path: '/team' }),
    owner({ id: 'EndAsk', title: 'إنهاء الدخول: سؤال', overlay: true, steps: [askEnd] }),
    owner({
      id: 'Ended',
      title: 'أنهيت دخول الدعم',
      steps: [askEnd, confirmEnd, { until: 'ownerSupportEndedTitle' }],
    }),
    owner({
      id: 'EndedMeanwhile',
      title: 'انتهت المدة قبل الإنهاء',
      answers: { [END]: endedMeanwhile },
      steps: [askEnd, confirmEnd, { wait: 800 }],
    }),
    owner({
      id: 'EndFailed',
      title: 'لم يُنهَ الدخول: خطأ في الخادم',
      overlay: true,
      answers: { [END]: [fail(500, 'internal_error')] },
      steps: [askEnd, confirmEnd, { until: 'ownerSupportEndFailed' }],
    }),
    owner({ id: 'Log', title: 'سجل دخول الدعم في الإعدادات', path: '/settings' }),
    {
      id: 'LogEmpty',
      title: 'سجل بلا دخول بعد',
      path: '/settings',
      world: (w) => {
        w.clinicA02.grants = [];
      },
    },
    { id: 'LogLoading', title: 'تحميل السجل', path: '/settings', answers: { [GRANTS]: 'hold' } },
    {
      id: 'LogFailed',
      title: 'تعذّر تحميل السجل',
      path: '/settings',
      answers: { [GRANTS]: 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    },
  ],
};

const showing =
  (...list: (keyof typeof ANNOUNCEMENTS)[]) =>
  (w: World) => {
    w.clinicA02.announcements = list.map((k) => ({ ...ANNOUNCEMENTS[k] }));
  };
const announced = (s: Omit<Scenario, 'path'> & { path?: string }): Scenario => ({
  path: '/',
  world: showing('warning', 'places', 'training'),
  ...s,
});
const hide = { press: 'annHide' } as const;

export const announcementsSheet: Sheet = {
  id: 'Announcements',
  title: 'إعلانات شفاء',
  route: '/',
  note: 'An announcement from Shifa above every page, for every member: a warning or a piece of information; several in the server’s order (the warning first) with «1 من 3», previous and next; «إخفاء الإعلان» shows the next one, the last one hidden leaves none; one that ended meanwhile is dropped; on another page, for a member who is not the owner, under the owner’s support banner; in a support session the hide is refused (403 `support_read_only`) and the announcement stays.',
  code: ['announcement-banner.tsx'],
  scenarios: [
    announced({ id: 'Warning', title: 'تنبيه', world: showing('warning') }),
    announced({ id: 'Info', title: 'معلومة', world: showing('places') }),
    announced({ id: 'Several', title: 'ثلاثة إعلانات: 1 من 3' }),
    announced({ id: 'Next', title: 'الإعلان التالي: 2 من 3', steps: [{ press: 'annNext' }] }),
    announced({ id: 'Hidden', title: 'أُخفي الأول: يظهر التالي', steps: [hide, { wait: 600 }] }),
    announced({
      id: 'LastHidden',
      title: 'أُخفي الأخير: لا إعلان',
      world: showing('places'),
      steps: [hide, { wait: 600 }],
    }),
    announced({
      id: 'EndedMeanwhile',
      title: 'انتهى الإعلان في الأثناء: يُسقط',
      world: showing('places', 'training'),
      answers: { 'POST /me/announcements/:id/dismiss': [fail(404, 'not_found')] },
      steps: [hide, { wait: 600 }],
    }),
    announced({ id: 'OnTeam', title: 'فوق صفحة الفريق', path: '/team', world: showing('warning') }),
    announced({
      id: 'Member',
      title: 'موظف (طبيب في فرع)',
      world: (w) => {
        showing('places')(w);
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
    announced({
      id: 'WithSupport',
      title: 'تحت شريط دخول الدعم',
      world: (w) => {
        showing('warning')(w);
        opened()(w);
      },
    }),
    announced({
      id: 'SupportHideRefused',
      title: 'دخول الدعم: الإخفاء مرفوض (للقراءة فقط)',
      world: (w) => {
        showing('warning')(w);
        w.session = supportSession();
      },
      steps: [hide, { until: 'readOnlyRefusedText' }],
    }),
  ],
};
