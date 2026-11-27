// «الإعلانات» on admin web (/announcements, A-02-09): the list by status with each status's count,
// ending or cancelling one (src/admin/announcements/announcements-page.tsx), and the dialog that
// creates or edits one with its banner preview (announcement-dialog.tsx).
import type { Answer, Scenario, Sheet, Step } from '../../scenario.ts';
import { fail } from '../../server.ts';
import { ANN, CLINIC_REF } from '../../world-a02-admin.ts';

const GET = 'GET /platform/announcements';
const POST = 'POST /platform/announcements';
const PATCH = 'PATCH /platform/announcements/:id';
const END = 'POST /platform/announcements/:id/end';
const page = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/announcements', ...s });
const dialog = (s: Omit<Scenario, 'path'>): Scenario => ({
  path: '/announcements',
  overlay: true,
  ...s,
});

const DIALOG = '[role="dialog"]';
const ALERT = '[role="alertdialog"]';
/** A status of the filter: 1 scheduled, 2 active, 3 ended. */
const filter = (n: 1 | 2 | 3): Step => ({
  click: `[aria-label="حالة الإعلان"] [role="radio"]:nth-child(${String(n)})`,
});
const create: Step = { press: 'annNew', nth: 0 };
/** The body (its label ends with the required mark, so it is found by its limit). */
const typed = (value: string): Step => ({
  fillIn: `${DIALOG} textarea[maxlength="280"]`,
  value,
});
const publish: Step = { press: 'annPublish' };
const NEW_BODY = 'تحديث التطبيق مساء الخميس. لا يلزمكم شيء.';
const endOf = (body: string): Step => ({ press: 'annEndOf', values: { body } });
const editOf = (body: string): Step => ({ press: 'annEditOf', values: { body } });
const endNow: Step = { press: 'annEndNow', within: ALERT };
const selected: Step[] = [
  { check: 'عيادات مختارة', within: DIALOG },
  { fillIn: `${DIALOG} input[role="combobox"]`, value: CLINIC_REF.active.name.split(' ')[1] ?? '' },
  { pressIn: CLINIC_REF.active.name },
  // Escape in the field closes the list (the dialog stays), as a person's does.
  { key: 'Escape', on: `${DIALOG} input[role="combobox"]` },
];
/** The announcement edited meanwhile ended: the world agrees, then the 409. */
const endedMeanwhile: Answer = (request, world) => {
  const a = world.adminA02.announcements.find((x) => x.id === request.id);
  if (a) a.endedEarly = true;
  return fail(409, 'announcement_ended');
};

export const announcementsSheet: Sheet = {
  // «Admin»: clinic web has a sheet `Announcements` (the banner); ids are unique across apps.
  id: 'AdminAnnouncements',
  title: 'الإعلانات',
  route: '/announcements',
  note: 'Announcements by status (active first), each status with its count: each row its level, body, author, period, state, targets and how many targeted members closed it; «تعديل» and «إنهاء الآن» (or «إلغاء» before it starts) while it has not ended. The scheduled and ended lists, a status with none, none at all, loading and a failed read; ending one (the question, ended, one that ended meanwhile, no network kept in the question) and cancelling a scheduled one.',
  code: ['admin/announcements/announcements-page.tsx', 'admin/announcements/data.ts'],
  scenarios: [
    page({ id: 'Active', title: 'النشطة: تنبيه للجميع ومعلومة لثلاث عيادات' }),
    page({ id: 'Scheduled', title: 'المجدولة', steps: [filter(1)] }),
    page({ id: 'Ended', title: 'المنتهية: أُنهي مبكرًا', steps: [filter(3)] }),
    page({
      id: 'NoneScheduled',
      title: 'لا إعلانات مجدولة',
      world: (w) => {
        w.adminA02.announcements = w.adminA02.announcements.filter((a) => a.status !== 'scheduled');
      },
      steps: [filter(1), { until: 'annNoneScheduledTitle' }],
    }),
    page({
      id: 'Empty',
      title: 'لا إعلانات بعد',
      world: (w) => {
        w.adminA02.announcements = [];
      },
    }),
    page({ id: 'Loading', title: 'تحميل الإعلانات', answers: { [GET]: 'hold' } }),
    page({ id: 'Offline', title: 'تعذّر التحميل: لا اتصال', answers: { [GET]: 'offline' } }),
    page({
      id: 'ServerError',
      title: 'تعذّر التحميل: خطأ في الخادم',
      answers: { [GET]: fail(500, 'internal_error') },
    }),
    page({
      id: 'EndAsk',
      title: 'إنهاء الآن: السؤال',
      overlay: true,
      steps: [endOf(ANN.maintenance)],
    }),
    page({
      id: 'EndDone',
      title: 'انتهى الإعلان',
      steps: [endOf(ANN.maintenance), endNow, { until: 'annEndedTitle' }],
    }),
    page({
      id: 'EndOffline',
      title: 'الإنهاء: لم يصل الرد',
      overlay: true,
      answers: { [END]: ['offline'] },
      steps: [endOf(ANN.maintenance), endNow, { until: 'unreachableTitle' }],
    }),
    page({
      id: 'EndGone',
      title: 'انتهى في الأثناء',
      answers: { [END]: endedMeanwhile },
      steps: [endOf(ANN.maintenance), endNow, { until: 'annGoneTitle' }],
    }),
    page({
      id: 'CancelAsk',
      title: 'إلغاء إعلان مجدول: السؤال',
      overlay: true,
      steps: [filter(1), { press: 'annCancelOf', values: { body: ANN.training } }],
    }),
  ],
};

export const announcementDialogSheet: Sheet = {
  id: 'AdminAnnouncementDialog',
  title: 'إعلان جديد وتعديله',
  route: '/announcements',
  note: '«إعلان جديد» and «تعديل الإعلان»: the body (plain text up to 280 characters; a link refused before sending, with the rule the server applies), the level, a preview of the banner as members will see it, start and optional end, all clinics or selected ones with the clinic picker. Missing body or clinics, publishing, published, an edit saved, a refused end time, one that ended meanwhile, no network and a server error kept with the input.',
  code: ['admin/announcements/announcement-dialog.tsx'],
  unshown: {
    announcement_link:
      'The dialog refuses a link before sending with the rule the API applies (hasAnnouncementLink, shared from the contracts), so the server never answers it to this screen; the Link state shows the same message.',
  },
  scenarios: [
    dialog({ id: 'New', title: 'إعلان جديد: فارغ', steps: [create] }),
    dialog({
      id: 'Preview',
      title: 'تنبيه مع المعاينة',
      steps: [create, typed(NEW_BODY), { check: 'تنبيه', within: DIALOG }],
    }),
    dialog({ id: 'Missing', title: 'نشر دون نص', steps: [create, publish] }),
    dialog({
      id: 'Link',
      title: 'رابط في النص: مرفوض قبل الإرسال',
      steps: [create, typed('حدّثوا التطبيق من www.example.com اليوم'), publish],
    }),
    dialog({
      id: 'Selected',
      title: 'لعيادات مختارة: عيادة واحدة',
      steps: [create, typed(NEW_BODY), ...selected],
    }),
    dialog({
      id: 'NoClinic',
      title: 'عيادات مختارة دون عيادة',
      steps: [create, typed(NEW_BODY), { check: 'عيادات مختارة', within: DIALOG }, publish],
    }),
    dialog({
      id: 'Sending',
      title: 'جارٍ النشر',
      answers: { [POST]: 'hold' },
      steps: [create, typed(NEW_BODY), publish],
    }),
    dialog({
      id: 'EndRefused',
      title: 'رفض الخادم وقت النهاية',
      answers: {
        [POST]: [
          fail(400, 'validation_failed', { details: [{ path: 'body.endsAt', code: 'invalid' }] }),
        ],
      },
      steps: [create, typed(NEW_BODY), publish, { until: 'annEndBeforeStart' }],
    }),
    dialog({
      id: 'Offline',
      title: 'لم يصل الرد: يبقى النص',
      answers: { [POST]: ['offline'] },
      steps: [create, typed(NEW_BODY), publish, { until: 'unreachableTitle' }],
    }),
    dialog({
      id: 'ServerError',
      title: 'خطأ في الخادم',
      answers: { [POST]: [fail(500, 'internal_error')] },
      steps: [create, typed(NEW_BODY), publish, { until: 'actionFailedTitle' }],
    }),
    page({
      id: 'Published',
      title: 'نُشر الإعلان',
      steps: [create, typed(NEW_BODY), ...selected, publish, { until: 'annCreatedActive' }],
    }),
    dialog({ id: 'Edit', title: 'تعديل إعلان نشط', steps: [editOf(ANN.places)] }),
    page({
      id: 'Saved',
      title: 'حُفظ التعديل',
      steps: [
        editOf(ANN.maintenance),
        typed('صيانة الليلة من 11 إلى 12:30. احفظوا عملكم قبلها.'),
        { press: 'annSaveEdit' },
        { until: 'annSavedTitle' },
      ],
    }),
    page({
      id: 'Gone',
      title: 'انتهى في الأثناء: يُغلق ويُذكر',
      answers: { [PATCH]: endedMeanwhile },
      steps: [
        editOf(ANN.maintenance),
        typed('صيانة الليلة من 11 إلى 1. احفظوا عملكم قبلها.'),
        { press: 'annSaveEdit' },
        { until: 'annGoneTitle' },
      ],
    }),
  ],
};
