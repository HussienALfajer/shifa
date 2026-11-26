// A clinic on admin web (/clinics/:id, A-01-10 checkpoint 3): the page and its subscription card
// (src/admin/clinic-page.tsx), the owner card and its support actions (owner-card.tsx), the
// pending owner's phone fixed (phone-dialog.tsx) and the owner's link shown once (link-shown.tsx).
import type { Scenario, Sheet, Step } from '../../scenario.ts';
import { fail } from '../../server.ts';
import {
  ACTIVE_CLINIC,
  ACTIVE_OWNER,
  EXPIRED_CLINIC,
  FREE_OWNER,
  NO_OWNER_CLINIC,
  OTHER_PENDING_PHONE,
  PENDING_CLINIC,
  SUSPENDED_CLINIC_ID,
  TRIAL_CLINIC,
  UNKNOWN_CLINIC,
} from '../../world-admin.ts';
import { local } from '../../world.ts';

const at = (id: string) => `/clinics/${id}`;
const page = (id: string, s: Omit<Scenario, 'path'>): Scenario => ({ path: at(id), ...s });
const GET = 'GET /platform/clinics/:id';
const PATCH = 'PATCH /platform/clinics/:id';
const suspend: Step = { check: 'موقوفة' };
const save: Step = { press: 'save' };

export const clinicSheet: Sheet = {
  id: 'Clinic',
  title: 'صفحة العيادة',
  route: '/clinics/:id',
  note: 'A clinic’s page: its name, type, creation date and status badge; the status and subscription card («حفظ» waits for a change, a warning when choosing «موقوفة», saving, saved, a server error that names the status still in force, a lost answer); loading, a failed read and an address with no clinic.',
  code: ['admin/clinic-page.tsx', 'admin/data.ts', 'account/load-failed.tsx'],
  scenarios: [
    page(ACTIVE_CLINIC, { id: 'Active', title: 'عيادة فعّالة' }),
    page(TRIAL_CLINIC, { id: 'Trial', title: 'عيادة تجريبية تنتهي قريبًا' }),
    page(SUSPENDED_CLINIC_ID, { id: 'Suspended', title: 'عيادة موقوفة' }),
    page(ACTIVE_CLINIC, { id: 'Loading', title: 'تحميل العيادة', answers: { [GET]: 'hold' } }),
    page(ACTIVE_CLINIC, {
      id: 'Offline',
      title: 'تعذّر التحميل: لا اتصال',
      answers: { [GET]: 'offline' },
    }),
    page(ACTIVE_CLINIC, {
      id: 'ServerError',
      title: 'تعذّر التحميل: خطأ في الخادم',
      answers: { [GET]: fail(500, 'internal_error') },
    }),
    page(UNKNOWN_CLINIC, { id: 'NotFound', title: 'لا عيادة بهذا العنوان' }),
    page(ACTIVE_CLINIC, { id: 'SuspendAsk', title: 'اختيار «موقوفة»: تحذير', steps: [suspend] }),
    page(ACTIVE_CLINIC, {
      id: 'Saving',
      title: 'جارٍ الحفظ',
      answers: { [PATCH]: 'hold' },
      steps: [suspend, save],
    }),
    page(ACTIVE_CLINIC, {
      id: 'Saved',
      title: 'حُفظت التغييرات',
      steps: [suspend, save, { until: 'clinicSaved' }],
    }),
    page(ACTIVE_CLINIC, {
      id: 'SaveServerError',
      title: 'لم تُحفظ: خطأ في الخادم',
      answers: { [PATCH]: [fail(500, 'internal_error')] },
      steps: [suspend, save, { until: 'clinicNotSavedTitle' }],
    }),
    page(ACTIVE_CLINIC, {
      id: 'SaveOffline',
      title: 'لم يصل الرد: لا نعرف إن حُفظت',
      answers: { [PATCH]: ['offline'] },
      steps: [suspend, save, { until: 'clinicNotSavedTitle' }],
    }),
  ],
};

const ask = (key: 'ownerNewLink' | 'ownerResetMfa' | 'ownerEndSessions'): Step => ({
  press: key,
});
const confirm = (
  key: 'ownerNewLinkAction' | 'ownerResetMfaAction' | 'ownerEndSessionsAction',
): Step => ({ press: key, within: '[role="alertdialog"]' });
const SETUP_LINK = 'POST /platform/clinics/:id/owner/setup-link';
const RESET = 'POST /platform/clinics/:id/owner/reset-mfa';
const END = 'POST /platform/clinics/:id/owner/end-sessions';

export const ownerCardSheet: Sheet = {
  id: 'OwnerCard',
  title: 'بطاقة المالك',
  route: '/clinics/:id',
  note: 'The owner card: an owner who has set up (masked phone), a pending owner with the link’s expiry, an expired link, no owner; each support action asked first (a new setup link, worded for a pending or a set-up owner; reset the second factor; end the sessions), being done, done, refused because the owner has not set up, a server error and a lost answer, and the new link shown once.',
  code: ['admin/owner-card.tsx'],
  unshown: {
    owner_account_exists:
      'Answered when a pending owner’s phone is corrected after they set up: shown on the PhoneDialog sheet («AccountExists»).',
  },
  scenarios: [
    page(ACTIVE_CLINIC, { id: 'Active', title: 'مالك أكمل الإعداد' }),
    page(PENDING_CLINIC, { id: 'Pending', title: 'مالك بانتظار الإعداد (ينتهي الرابط)' }),
    page(EXPIRED_CLINIC, { id: 'Expired', title: 'انتهى رابط المالك' }),
    page(NO_OWNER_CLINIC, { id: 'NoOwner', title: 'عيادة بلا مالك' }),
    page(PENDING_CLINIC, {
      id: 'NewLinkAskPending',
      title: 'رابط جديد لمالك بانتظار الإعداد: سؤال',
      overlay: true,
      steps: [ask('ownerNewLink')],
    }),
    page(ACTIVE_CLINIC, {
      id: 'NewLinkAskActive',
      title: 'رابط جديد لمالك أكمل الإعداد: سؤال',
      overlay: true,
      steps: [ask('ownerNewLink')],
    }),
    page(PENDING_CLINIC, {
      id: 'NewLinkSending',
      title: 'جارٍ إصدار الرابط',
      overlay: true,
      answers: { [SETUP_LINK]: 'hold' },
      steps: [ask('ownerNewLink'), confirm('ownerNewLinkAction')],
    }),
    page(EXPIRED_CLINIC, {
      id: 'NewLink',
      title: 'الرابط الجديد مرة واحدة',
      steps: [ask('ownerNewLink'), confirm('ownerNewLinkAction'), { until: 'linkNewTitle' }],
    }),
    page(PENDING_CLINIC, {
      id: 'NewLinkServerError',
      title: 'الرابط الجديد: خطأ في الخادم',
      overlay: true,
      answers: { [SETUP_LINK]: [fail(500, 'internal_error')] },
      steps: [ask('ownerNewLink'), confirm('ownerNewLinkAction'), { until: 'serverErrorText' }],
    }),
    page(PENDING_CLINIC, {
      id: 'NewLinkOffline',
      title: 'الرابط الجديد: لم يصل الرد',
      overlay: true,
      answers: { [SETUP_LINK]: ['offline'] },
      steps: [ask('ownerNewLink'), confirm('ownerNewLinkAction'), { until: 'ownerActionUnknown' }],
    }),
    page(ACTIVE_CLINIC, {
      id: 'ResetMfaAsk',
      title: 'إعادة ضبط التحقق بخطوتين: سؤال',
      overlay: true,
      steps: [ask('ownerResetMfa')],
    }),
    page(ACTIVE_CLINIC, {
      id: 'ResetMfaDone',
      title: 'أُعيد ضبط التحقق بخطوتين',
      steps: [ask('ownerResetMfa'), confirm('ownerResetMfaAction'), { until: 'ownerResetMfaDone' }],
    }),
    page(ACTIVE_CLINIC, {
      id: 'ResetMfaNotSetUp',
      title: 'إعادة الضبط: المالك لم يُكمل الإعداد',
      answers: { [RESET]: [fail(409, 'owner_setup_pending')] },
      steps: [
        ask('ownerResetMfa'),
        confirm('ownerResetMfaAction'),
        { until: 'ownerNotSetUpTitle' },
      ],
    }),
    page(ACTIVE_CLINIC, {
      id: 'EndSessionsAsk',
      title: 'إنهاء جلسات المالك: سؤال',
      overlay: true,
      steps: [ask('ownerEndSessions')],
    }),
    page(ACTIVE_CLINIC, {
      id: 'EndSessionsRunning',
      title: 'جارٍ إنهاء الجلسات',
      overlay: true,
      answers: { [END]: 'hold' },
      steps: [ask('ownerEndSessions'), confirm('ownerEndSessionsAction')],
    }),
    page(ACTIVE_CLINIC, {
      id: 'EndSessionsDone',
      title: 'انتهت كل جلسات المالك',
      steps: [
        ask('ownerEndSessions'),
        confirm('ownerEndSessionsAction'),
        { until: 'ownerEndSessionsDone' },
      ],
    }),
    page(ACTIVE_CLINIC, {
      id: 'EndSessionsServerError',
      title: 'إنهاء الجلسات: خطأ في الخادم',
      overlay: true,
      answers: { [END]: [fail(500, 'internal_error')] },
      steps: [
        ask('ownerEndSessions'),
        confirm('ownerEndSessionsAction'),
        { until: 'serverErrorText' },
      ],
    }),
  ],
};

const fix: Step = { press: 'ownerFixPhone' };
const typed = (phone: string): Step => ({ fill: 'ownerFixPhoneField', value: phone });
const send: Step = { press: 'ownerFixPhoneAction' };
const OWNER = 'PATCH /platform/clinics/:id/owner';
const FREE = local(FREE_OWNER.phone);
const dialog = (s: Omit<Scenario, 'path'>): Scenario => ({
  path: at(PENDING_CLINIC),
  overlay: true,
  ...s,
});

export const phoneDialogSheet: Sheet = {
  id: 'PhoneDialog',
  title: 'تصحيح هاتف المالك',
  route: '/clinics/:id',
  note: 'Correcting a pending owner’s phone: the dialog, an empty number, sending; the server’s refusals (a phone it cannot read, a phone whose other clinic is not set up, an owner who set up meanwhile, which closes and reads the clinic again), no network and a server error; the new link shown once on the card.',
  code: ['admin/phone-dialog.tsx', 'admin/phone.ts'],
  scenarios: [
    dialog({ id: 'Open', title: 'نافذة التصحيح', steps: [fix] }),
    dialog({ id: 'Missing', title: 'رقم فارغ', steps: [fix, send] }),
    dialog({
      id: 'Sending',
      title: 'جارٍ الحفظ',
      answers: { [OWNER]: 'hold' },
      steps: [fix, typed(FREE), send],
    }),
    dialog({
      id: 'Invalid',
      title: 'رفض الخادم: رقم غير صحيح',
      steps: [fix, typed('0912'), send, { until: 'phoneInvalid' }],
    }),
    dialog({
      id: 'Pending',
      title: 'للرقم عيادة أخرى لم يُكمل مالكها الإعداد',
      steps: [fix, typed(local(OTHER_PENDING_PHONE)), send, { until: 'createPendingTitle' }],
    }),
    dialog({
      id: 'Offline',
      title: 'لم يصل الرد: لا نعرف إن تغيّر',
      answers: { [OWNER]: ['offline'] },
      steps: [fix, typed(FREE), send, { until: 'adminPhoneUnknownText' }],
    }),
    dialog({
      id: 'ServerError',
      title: 'خطأ في الخادم',
      answers: { [OWNER]: [fail(500, 'internal_error')] },
      steps: [fix, typed(FREE), send, { until: 'actionFailedTitle' }],
    }),
    {
      id: 'AccountExists',
      title: 'أكمل المالك الإعداد أثناء ذلك',
      path: at(PENDING_CLINIC),
      answers: { [OWNER]: [fail(409, 'owner_account_exists')] },
      steps: [fix, typed(FREE), send, { until: 'ownerAccountExistsTitle' }],
    },
    {
      id: 'Issued',
      title: 'حُفظ الرقم: الرابط الجديد مرة واحدة',
      path: at(PENDING_CLINIC),
      steps: [fix, typed(FREE), send, { until: 'linkNewTitle' }],
    },
  ],
};

const newLink: Step[] = [
  ask('ownerNewLink'),
  confirm('ownerNewLinkAction'),
  { until: 'linkNewTitle' },
];
const linkState = (s: Omit<Scenario, 'path'>): Scenario => ({ path: at(EXPIRED_CLINIC), ...s });

export const linkShownSheet: Sheet = {
  id: 'LinkShown',
  title: 'رابط المالك مرة واحدة',
  route: '/clinics/:id',
  note: 'The owner’s link, shown once: the copy field with copy and WhatsApp and the expiry, the QR code for an owner who is present; a setup link or an invitation (a phone with an account); copied (or refused by the browser); the question before leaving it uncopied, stayed or left.',
  code: ['admin/link-shown.tsx'],
  scenarios: [
    linkState({ id: 'Setup', title: 'رابط إعداد', steps: newLink }),
    {
      id: 'Invitation',
      title: 'رابط دعوة (للرقم حساب)',
      path: at(PENDING_CLINIC),
      steps: [
        { press: 'ownerFixPhone' },
        { fill: 'ownerFixPhoneField', value: local(ACTIVE_OWNER.phone) },
        { press: 'ownerFixPhoneAction' },
        { until: 'linkInvitation' },
      ],
    },
    linkState({
      id: 'Copy',
      title: 'نسخ الرابط',
      steps: [...newLink, { press: 'linkCopy' }, { wait: 600 }],
    }),
    linkState({
      id: 'LeaveAsk',
      title: 'المغادرة قبل النسخ: سؤال',
      overlay: true,
      steps: [...newLink, { press: 'navClinics' }, { until: 'linkLeaveTitle' }],
    }),
    linkState({
      id: 'Stayed',
      title: 'البقاء: الرابط ما زال ظاهرًا',
      steps: [...newLink, { press: 'navClinics' }, { press: 'linkLeaveStay' }, { wait: 600 }],
    }),
    linkState({
      id: 'Left',
      title: 'المغادرة دون نسخ: العيادات',
      steps: [
        ...newLink,
        { press: 'navClinics' },
        { press: 'linkLeaveGo' },
        { until: 'clinicsText' },
      ],
    }),
  ],
};
