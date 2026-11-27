// The clinic page tabs on admin web (/clinics/:id, A-02-08): «الاشتراك والحدود» with the override
// dialog, a limit's history and the type change (src/admin/limits-tab.tsx, override-dialog.tsx,
// override-history.tsx, type-dialog.tsx, tab-parts.tsx); the other three tabs are in
// tabs-more.ts. Each state opens the active multi-branch clinic and presses its tab.
import type { Scenario, Sheet, Step } from '../../scenario.ts';
import { fail } from '../../server.ts';
import { onTab, settingsSheet, supportSheet, usageSheet } from './tabs-more.ts';

const limits = onTab('clinicTabLimits');
const dialog = (s: Omit<Scenario, 'path'>) => limits({ overlay: true, ...s });

const ENTITLEMENTS = 'GET /platform/clinics/:id/entitlements';
const PUT = 'PUT /platform/clinics/:id/overrides/:key';
const DELETE = 'DELETE /platform/clinics/:id/overrides/:key';
const HISTORY = 'GET /platform/clinics/:id/overrides/:key/history';
const PREVIEW = 'GET /platform/clinics/:id/type-preview';
const PATCH = 'PATCH /platform/clinics/:id';

/** «تعديل» of the doctors' limit (the first row with an override). */
const editDoctors: Step = { press: 'overrideEdit', nth: 0 };
// The reason is the dialog's one textarea (its required label ends with the asterisk).
const reason: Step = { fillIn: '[role="dialog"] textarea', value: 'افتتاح قسم الأطفال المسائي' };
const save: Step = { press: 'overrideSave' };
const askRemove: Step = { press: 'overrideRemove', nth: 0 };
const inAlert = '[role="alertdialog"]';
const inDialog = '[role="dialog"]';
const typeAsk: Step = { press: 'typeChange' };
const typeSend: Step = { press: 'typeChange', within: inDialog };
const solo = { type: 'عيادة فردية' };

export const limitsSheet: Sheet = {
  id: 'ClinicLimits',
  title: 'صفحة العيادة · الاشتراك والحدود',
  route: '/clinics/:id',
  note: 'The clinic page’s «الاشتراك والحدود» tab: the plan from the clinic’s type with «تغيير النوع»; each limit with its plan value, override (an active one until a date with its reason, an expired one struck through), effective value and use («—» while not counted). The override dialog (the plan and the use, value, a required reason, an optional expiry after today): a missing reason, sending, saved, the server refusing a field, a key changed meanwhile, a server error, a lost answer. Removing an override (asked first, saved, failed), a limit’s history (every change, empty, loading), and the type change with its preview (a limit over the new value warned, loading, saved, failed, a lost answer). Loading and a failed read.',
  code: [
    'admin/limits-tab.tsx',
    'admin/override-dialog.tsx',
    'admin/override-history.tsx',
    'admin/type-dialog.tsx',
    'admin/tab-parts.tsx',
    'admin/clinic-data.ts',
  ],
  scenarios: [
    limits({ id: 'Limits', title: 'الخطة والحدود' }),
    limits({ id: 'Loading', title: 'تحميل الحدود', answers: { [ENTITLEMENTS]: 'hold' } }),
    limits({
      id: 'Failed',
      title: 'تعذّر تحميل الحدود',
      answers: { [ENTITLEMENTS]: 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    dialog({ id: 'OverrideEdit', title: 'تعديل تجاوز الأطباء', steps: [editDoctors] }),
    dialog({
      id: 'OverrideAdd',
      title: 'تجاوز جديد لحد الفروع',
      steps: [{ press: 'overrideAdd', nth: 0 }],
    }),
    dialog({
      id: 'OverrideReasonMissing',
      title: 'التجاوز دون سبب',
      steps: [editDoctors, save, { until: 'overrideReasonMissing' }],
    }),
    dialog({
      id: 'OverrideSaving',
      title: 'جارٍ حفظ التجاوز',
      answers: { [PUT]: 'hold' },
      steps: [editDoctors, reason, save],
    }),
    limits({
      id: 'OverrideSaved',
      title: 'حُفظ التجاوز',
      steps: [editDoctors, reason, save, { until: 'overrideSavedTitle' }],
    }),
    dialog({
      id: 'OverrideRefused',
      title: 'رفض الخادم تاريخ الانتهاء',
      answers: {
        [PUT]: [fail(400, 'validation_failed', { details: [{ path: 'body.expiresAt' }] })],
      },
      steps: [editDoctors, reason, save, { until: 'overrideExpiryPast' }],
    }),
    dialog({
      id: 'OverrideServerError',
      title: 'لم يُحفظ التجاوز: خطأ في الخادم',
      answers: { [PUT]: [fail(500, 'internal_error')] },
      steps: [editDoctors, reason, save, { until: 'actionFailedTitle' }],
    }),
    dialog({
      id: 'OverrideOffline',
      title: 'لم يصل الرد: لا نعرف إن حُفظ',
      answers: { [PUT]: ['offline'] },
      steps: [editDoctors, reason, save, { until: 'unreachableTitle' }],
    }),
    limits({
      id: 'OverrideGone',
      title: 'تغيّرت الحدود في الأثناء',
      answers: { [PUT]: [fail(404, 'not_found')] },
      steps: [editDoctors, reason, save, { until: 'overrideGoneTitle' }],
    }),
    dialog({ id: 'RemoveAsk', title: 'إزالة التجاوز: سؤال', steps: [askRemove] }),
    limits({
      id: 'Removed',
      title: 'أُزيل التجاوز',
      steps: [
        askRemove,
        { press: 'overrideRemoveAction', within: inAlert },
        { until: 'overrideRemovedTitle' },
      ],
    }),
    dialog({
      id: 'RemoveFailed',
      title: 'لم يُزل التجاوز: خطأ في الخادم',
      answers: { [DELETE]: [fail(500, 'internal_error')] },
      steps: [
        askRemove,
        { press: 'overrideRemoveAction', within: inAlert },
        { until: 'serverErrorText' },
      ],
    }),
    dialog({
      id: 'History',
      title: 'سجل حد الأطباء',
      steps: [{ press: 'overrideHistory', nth: 0 }, { until: 'historyChanged' }],
    }),
    dialog({
      id: 'HistoryEmpty',
      title: 'سجل بلا تغييرات',
      steps: [{ press: 'overrideHistory', nth: 1 }, { until: 'historyEmpty' }],
    }),
    dialog({
      id: 'HistoryLoading',
      title: 'تحميل السجل',
      answers: { [HISTORY]: 'hold' },
      steps: [{ press: 'overrideHistory', nth: 0 }],
    }),
    dialog({
      id: 'TypeAsk',
      title: 'تغيير النوع: الفروع فوق الحد الجديد',
      steps: [typeAsk, { untilSel: `${inDialog} [data-row]` }],
    }),
    dialog({
      id: 'TypeLoading',
      title: 'تغيير النوع: جارٍ حساب الحدود',
      answers: { [PREVIEW]: 'hold' },
      steps: [typeAsk],
    }),
    limits({
      id: 'TypeSaved',
      title: 'تغيّر النوع إلى عيادة فردية',
      steps: [
        typeAsk,
        { untilSel: `${inDialog} [data-row]` },
        typeSend,
        { until: 'typeSavedTitle', values: solo },
      ],
    }),
    dialog({
      id: 'TypeServerError',
      title: 'لم يتغيّر النوع: خطأ في الخادم',
      answers: { [PATCH]: [fail(500, 'internal_error')] },
      steps: [typeAsk, { untilSel: `${inDialog} [data-row]` }, typeSend, { wait: 600 }],
    }),
    dialog({
      id: 'TypeOffline',
      title: 'لم يصل الرد: لا نعرف إن تغيّر النوع',
      answers: { [PATCH]: ['offline'] },
      steps: [
        typeAsk,
        { untilSel: `${inDialog} [data-row]` },
        typeSend,
        { until: 'typeUnknownText' },
      ],
    }),
  ],
};

/** The four tabs, in the order of the page's tab list. */
export const TAB_SHEETS: Sheet[] = [limitsSheet, settingsSheet, supportSheet, usageSheet];
