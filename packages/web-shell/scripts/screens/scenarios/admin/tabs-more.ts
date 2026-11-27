// The clinic page tabs on admin web (/clinics/:id, A-02-08), continued: «الإعدادات» with the
// super admin's lock (src/admin/settings-tab.tsx), «دخول الدعم» with its log
// (support-tab.tsx, support-log.tsx, support-handoff.ts) and «الاستخدام» (usage-tab.tsx).
import type { Answer, Scenario, Sheet, Step, World } from '../../scenario.ts';
import { fail } from '../../server.ts';
import { at } from '../../world.ts';
import { grantId, idleSetting, tabsOf } from '../../world-a02-tabs.ts';
import {
  ACTIVE_CLINIC,
  ADMIN_NAME,
  PENDING_CLINIC,
  SUSPENDED_CLINIC_ID,
} from '../../world-admin.ts';

/** A state of a tab: the clinic's page, the tab pressed, then the state's own steps. */
export const onTab =
  (tab: 'clinicTabLimits' | 'clinicTabSettings' | 'clinicTabSupport' | 'clinicTabUsage') =>
  (s: Omit<Scenario, 'path'>, clinic = ACTIVE_CLINIC): Scenario => ({
    ...s,
    path: `/clinics/${clinic}`,
    steps: [{ press: tab }, ...(s.steps ?? [])],
  });

const inAlert = '[role="alertdialog"]';
const inDialog = '[role="dialog"]';
const active = (w: World) => tabsOf(w, ACTIVE_CLINIC);

// ---- «الإعدادات»

const settings = onTab('clinicTabSettings');
const SETTINGS = 'GET /platform/clinics/:id/settings';
const LOCK = 'PUT /platform/clinics/:id/settings/:key/lock';

/** The idle setting locked by this super admin at an hour. */
const lockedByAdmin = (w: World) => {
  active(w).settings = [
    idleSetting({ value: 60, source: 'organization', locked: true, lockedBy: 'organization' }),
  ];
};
const openLock: Step = { press: 'settingLock' };
const sendLock: Step = { press: 'lockAction', within: inDialog };
const askUnlock: Step = { press: 'settingUnlock' };

export const settingsSheet: Sheet = {
  id: 'ClinicSettings',
  title: 'صفحة العيادة · الإعدادات',
  route: '/clinics/:id',
  note: 'The clinic page’s «الإعدادات» tab: each setting with its effective value and where it comes from («موروث من: الإعداد الافتراضي», «من: الإدارة», «من: المنصة»), «مقفل من الإدارة»; the super admin only locks with a value and unlocks, never sets: the lock dialog (a value from the setting’s choices), locked, a value the server refuses, a lock of the platform meanwhile, a setting gone meanwhile, a server error; unlocking (asked first, done). A platform lock offers no action. No setting yet, loading and a failed read.',
  code: ['admin/settings-tab.tsx'],
  scenarios: [
    settings({ id: 'Inherited', title: 'موروث من الإعداد الافتراضي' }),
    settings({
      id: 'LockedByAdmin',
      title: 'مقفل من الإدارة على ساعة',
      world: lockedByAdmin,
    }),
    settings({
      id: 'LockedByPlatform',
      title: 'مقفل من المنصة: لا إجراء',
      world: (w) => {
        active(w).settings = [
          idleSetting({
            value: 15,
            source: 'platform',
            locked: true,
            lockedBy: 'platform',
            lockable: false,
          }),
        ];
      },
    }),
    settings({ id: 'Loading', title: 'تحميل الإعدادات', answers: { [SETTINGS]: 'hold' } }),
    settings({
      id: 'Failed',
      title: 'تعذّر تحميل الإعدادات',
      answers: { [SETTINGS]: 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    settings({
      id: 'None',
      title: 'لا إعدادات للعيادة بعد',
      world: (w) => {
        active(w).settings = [];
      },
    }),
    settings({ id: 'LockOpen', title: 'قفل بقيمة: النافذة', overlay: true, steps: [openLock] }),
    settings({
      id: 'Locked',
      title: 'قُفل الإعداد على ساعة',
      steps: [
        openLock,
        { click: `${inDialog} button[role="combobox"], ${inDialog} [aria-haspopup="listbox"]` },
        { pressText: '60 دقيقة' },
        sendLock,
        { until: 'lockedText' },
      ],
    }),
    settings({
      id: 'LockValueRefused',
      title: 'رفض الخادم القيمة',
      overlay: true,
      answers: { [LOCK]: [fail(400, 'validation_failed', { details: [{ path: 'body.value' }] })] },
      steps: [openLock, sendLock, { until: 'lockValueInvalid' }],
    }),
    settings({
      id: 'LockRefused',
      title: 'قفلته المنصة في الأثناء',
      answers: { [LOCK]: [fail(409, 'setting_locked')] },
      steps: [openLock, sendLock, { until: 'notLockableTitle' }],
    }),
    settings({
      id: 'LockNotLockable',
      title: 'إعداد لا يُقفل',
      answers: { [LOCK]: [fail(409, 'setting_not_lockable')] },
      steps: [openLock, sendLock, { until: 'notLockableTitle' }],
    }),
    settings({
      id: 'LockGone',
      title: 'تغيّرت الإعدادات في الأثناء',
      answers: { [LOCK]: [fail(404, 'not_found')] },
      steps: [openLock, sendLock, { until: 'settingGoneTitle' }],
    }),
    settings({
      id: 'LockServerError',
      title: 'لم يُقفل: خطأ في الخادم',
      overlay: true,
      answers: { [LOCK]: [fail(500, 'internal_error')] },
      steps: [openLock, sendLock, { until: 'actionFailedTitle' }],
    }),
    settings({
      id: 'UnlockAsk',
      title: 'فتح القفل: سؤال',
      overlay: true,
      world: lockedByAdmin,
      steps: [askUnlock],
    }),
    settings({
      id: 'Unlocked',
      title: 'فُتح القفل',
      world: lockedByAdmin,
      steps: [askUnlock, { press: 'settingUnlock', within: inAlert }, { until: 'unlockedTitle' }],
    }),
  ],
};

// ---- «دخول الدعم»

const support = onTab('clinicTabSupport');
const OPEN = 'POST /platform/clinics/:id/support-grants';
const GRANTS = 'GET /platform/clinics/:id/support-grants';
const SUPPORT_REASON = 'المالك لا يرى فروعه بعد النقل إلى الجميلية';

/** This super admin's grant open on the clinic, 42 minutes left. */
const openMine = (w: World) => {
  active(w).grants.unshift({
    id: grantId(9),
    adminName: ADMIN_NAME,
    reason: SUPPORT_REASON,
    startedAt: at(-18 * 60_000),
    expiresAt: at(42 * 60_000),
    endedAt: null,
    endedBy: null,
    endedByName: null,
  });
};
// The form's one textarea (its required label ends with the asterisk).
const typed: Step = { fillIn: '[role="tabpanel"] textarea', value: SUPPORT_REASON };
const send: Step = { press: 'supportOpen' };
/** Another tab opened a grant meanwhile: the world has it, then the open is refused. */
const openedElsewhere: Answer = (_r, w) => {
  openMine(w);
  return fail(409, 'support_active');
};

export const supportSheet: Sheet = {
  id: 'ClinicSupport',
  title: 'صفحة العيادة · دخول الدعم',
  route: '/clinics/:id',
  note: 'The clinic page’s «دخول الدعم» tab: the form (a reason of 10 to 500 characters, 30 min to 4 h) that opens clinic web in a new tab at a single-use hand-off; a short reason, opening, a grant already open from another tab, a server error, a lost answer. With this super admin’s grant open: «دخولك مفتوح» with the time left, «فتح عيادة الويب» and «إنهاء» (asked, ended, ended meanwhile). The canvas’s frames allow no new tab, so a hand-off there shows the browser’s refusal, as a browser blocking pop-ups would. A suspended clinic can still be opened. The log below in the DataTable with «السبب» wrapping; no grant yet; loading and a failed read.',
  code: ['admin/support-tab.tsx', 'admin/support-log.tsx', 'admin/support-handoff.ts'],
  scenarios: [
    support({ id: 'Form', title: 'فتح دخول الدعم والسجل' }),
    support({ id: 'Open', title: 'دخولك مفتوح: متبقٍّ 42 دقيقة', world: openMine }),
    support({ id: 'Loading', title: 'تحميل دخول الدعم', answers: { [GRANTS]: 'hold' } }),
    support({
      id: 'Failed',
      title: 'تعذّر تحميل دخول الدعم',
      answers: { [GRANTS]: 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    support({
      id: 'LogEmpty',
      title: 'لا دخول دعم بعد',
      world: (w) => {
        active(w).grants = [];
      },
    }),
    support({ id: 'Suspended', title: 'عيادة موقوفة: يمكن فتح الدخول' }, SUSPENDED_CLINIC_ID),
    support({
      id: 'ReasonShort',
      title: 'سبب قصير',
      steps: [send, { until: 'supportReasonShort' }],
    }),
    support({
      id: 'Opening',
      title: 'جارٍ فتح الدخول',
      answers: { [OPEN]: 'hold' },
      steps: [typed, send],
    }),
    support({
      id: 'OpenedBlocked',
      title: 'فُتح الدخول ومنع المتصفح التبويب الجديد',
      steps: [typed, send, { until: 'supportOpenTitle' }],
    }),
    support({
      id: 'Active',
      title: 'لديك دخول مفتوح من تبويب آخر',
      answers: { [OPEN]: openedElsewhere },
      steps: [typed, send, { until: 'supportActiveTitle' }],
    }),
    support({
      id: 'OpenServerError',
      title: 'لم يُفتح: خطأ في الخادم',
      answers: { [OPEN]: [fail(500, 'internal_error')] },
      steps: [typed, send, { until: 'actionFailedTitle' }],
    }),
    support({
      id: 'OpenOffline',
      title: 'لم يصل الرد: لا نعرف إن فُتح',
      answers: { [OPEN]: ['offline'] },
      steps: [typed, send, { until: 'unreachableTitle' }],
    }),
    support({
      id: 'HandoffBlocked',
      title: '«فتح عيادة الويب»: منع المتصفح التبويب',
      world: openMine,
      steps: [{ press: 'supportOpenWeb' }, { until: 'supportTabFailedTitle' }],
    }),
    support({
      id: 'HandoffGone',
      title: 'انتهى الدخول قبل فتح عيادة الويب',
      world: openMine,
      answers: { 'POST /platform/support-grants/:id/handoff': [fail(409, 'support_ended')] },
      steps: [{ press: 'supportOpenWeb' }, { until: 'supportGoneTitle' }],
    }),
    support({
      id: 'EndAsk',
      title: 'إنهاء الدخول: سؤال',
      overlay: true,
      world: openMine,
      steps: [{ press: 'supportEnd' }],
    }),
    support({
      id: 'Ended',
      title: 'انتهى دخولك',
      world: openMine,
      steps: [
        { press: 'supportEnd' },
        { press: 'supportEndAction', within: inAlert },
        { until: 'supportEndedTitle' },
      ],
    }),
    support({
      id: 'EndedMeanwhile',
      title: 'انتهى الدخول في الأثناء',
      world: openMine,
      answers: { 'POST /platform/support-grants/:id/end': [fail(409, 'support_ended')] },
      steps: [
        { press: 'supportEnd' },
        { press: 'supportEndAction', within: inAlert },
        { until: 'supportGoneTitle' },
      ],
    }),
  ],
};

// ---- «الاستخدام»

const usage = onTab('clinicTabUsage');
const USAGE = 'GET /platform/clinics/:id/usage';

export const usageSheet: Sheet = {
  id: 'ClinicUsage',
  title: 'صفحة العيادة · الاستخدام',
  route: '/clinics/:id',
  note: 'The clinic page’s «الاستخدام» tab: the last activity, today’s four figures (each with yesterday’s or its whole), the last 30 Damascus days in the UsageChart with the total and its change against the 30 days before, the daily average, the highest day and the days without activity; the series switched to members who signed in; a quiet suspended clinic; a clinic with no counter yet; loading and a failed read.',
  code: ['admin/usage-tab.tsx'],
  scenarios: [
    usage({ id: 'SignIns', title: 'تسجيلات الدخول في 30 يومًا' }),
    usage({
      id: 'Members',
      title: 'الأعضاء الذين سجّلوا الدخول',
      steps: [{ press: 'usageSeriesMembers' }],
    }),
    usage({ id: 'Quiet', title: 'عيادة موقوفة بلا نشاط' }, SUSPENDED_CLINIC_ID),
    usage({ id: 'Empty', title: 'لا بيانات استخدام بعد' }, PENDING_CLINIC),
    usage({ id: 'Loading', title: 'تحميل الاستخدام', answers: { [USAGE]: 'hold' } }),
    usage({
      id: 'Failed',
      title: 'تعذّر تحميل الاستخدام',
      answers: { [USAGE]: 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
  ],
};
