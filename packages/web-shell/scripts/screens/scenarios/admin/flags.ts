// «الميزات التجريبية» on admin web (/flags, A-02-09): the list of every flag declared in code
// (src/admin/flags/flags-page.tsx) and its «تغيير» dialog with the confirmation (flag-dialog.tsx).
import type { Scenario, Sheet, Step } from '../../scenario.ts';
import { fail } from '../../server.ts';
import { CLINIC_REF } from '../../world-a02-admin.ts';

const GET = 'GET /platform/flags';
const PUT = 'PUT /platform/flags/:key';
const page = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/flags', ...s });
const dialog = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/flags', overlay: true, ...s });

const DIALOG = '[role="dialog"]';
/** «تغيير» of a flag, by its description (its title until the flag has one in i18n). */
const change = (description: string): Step => ({
  press: 'flagChangeOf',
  values: { name: description },
});
const UNTOUCHED = 'Weekly grid instead of the list';
const ON_ALL = 'Send offline changes together';
const SELECTED = 'Call the next patient by voice on the display';
const mode = (word: string): Step => ({ check: word, within: DIALOG });
/** The reason (its label ends with the required mark, so it is found by its limit). */
const REASON = `${DIALOG} textarea[maxlength="500"]`;
const reason: Step = { fillIn: REASON, value: 'تجربة الجدول الأسبوعي في عيادة واحدة أولًا' };
const next: Step = { press: 'flagContinue' };
const confirm: Step = { press: 'flagConfirm' };
/** Picks a clinic in the picker: typed, then chosen from the list. */
const pick = (name: string): Step[] => [
  { fillIn: `${DIALOG} input[role="combobox"]`, value: name.split(' ')[1] ?? name },
  { pressIn: name },
  // Escape in the field closes the list (the dialog stays), as a person's does.
  { key: 'Escape', on: `${DIALOG} input[role="combobox"]` },
];
const toSelected: Step[] = [
  change(UNTOUCHED),
  mode('لعيادات مختارة'),
  ...pick(CLINIC_REF.pending.name),
  reason,
];

export const flagsSheet: Sheet = {
  id: 'Flags',
  title: 'الميزات التجريبية',
  route: '/flags',
  note: 'Every short-lived flag declared in code: its description and key, the default in code, its mode as a badge (danger «مطفأة للجميع» once switched off, as a kill switch, neutral while never changed), the clinics of «لعيادات مختارة» or those kept while off, the reason and who changed it last. Loading, a failed read (no network, a server error) and no flag declared yet.',
  code: ['admin/flags/flags-page.tsx', 'admin/flags/data.ts'],
  scenarios: [
    page({ id: 'List', title: 'كل الميزات: لم تُغيَّر، مفعّلة، مختارة، مطفأة' }),
    page({ id: 'Loading', title: 'تحميل الميزات', answers: { [GET]: 'hold' } }),
    page({ id: 'Offline', title: 'تعذّر التحميل: لا اتصال', answers: { [GET]: 'offline' } }),
    page({
      id: 'ServerError',
      title: 'تعذّر التحميل: خطأ في الخادم',
      answers: { [GET]: fail(500, 'internal_error') },
    }),
    page({
      id: 'None',
      title: 'لا ميزات معرّفة في الشيفرة',
      world: (w) => {
        w.adminA02.flags = [];
      },
    }),
  ],
};

export const flagDialogSheet: Sheet = {
  id: 'FlagDialog',
  title: 'تغيير ميزة تجريبية',
  route: '/flags',
  note: '«تغيير» of a flag: the mode (off for all with its kill-switch warning, on for all, selected clinics with the clinic picker), the reason of 10–500 characters; «متابعة» checks them, then a confirmation names the change and the clinics. Saving, saved (the page names the new mode and reads again), the server’s refusals on the reason or the clinics back on the field, a flag gone from the code (the page names it), no network and a server error kept in the confirmation.',
  code: ['admin/flags/flag-dialog.tsx', 'admin/a02.tsx'],
  scenarios: [
    dialog({ id: 'Open', title: 'النافذة: ميزة لم تُغيَّر', steps: [change(UNTOUCHED)] }),
    dialog({
      id: 'KillSwitch',
      title: 'إطفاء للجميع: تحذير مفتاح الإيقاف',
      steps: [change(ON_ALL), mode('مطفأة للجميع')],
    }),
    dialog({
      id: 'Selected',
      title: 'لعيادات مختارة: العيادات المحفوظة',
      steps: [change(SELECTED)],
    }),
    dialog({
      id: 'Picking',
      title: 'اختيار عيادة من القائمة',
      steps: [
        change(UNTOUCHED),
        mode('لعيادات مختارة'),
        { fillIn: `${DIALOG} input[role="combobox"]`, value: 'عيادة' },
        { wait: 400 },
      ],
    }),
    dialog({
      id: 'Missing',
      title: 'متابعة دون عيادة ودون سبب',
      steps: [change(UNTOUCHED), mode('لعيادات مختارة'), next],
    }),
    dialog({
      id: 'Confirm',
      title: 'التأكيد: من «مطفأة» إلى عيادات مختارة',
      steps: [...toSelected, next, { until: 'flagConfirmTitle' }],
    }),
    dialog({
      id: 'Saving',
      title: 'جارٍ الحفظ',
      answers: { [PUT]: 'hold' },
      steps: [...toSelected, next, confirm],
    }),
    dialog({
      id: 'Offline',
      title: 'لم يصل الرد: يبقى التأكيد',
      answers: { [PUT]: ['offline'] },
      steps: [...toSelected, next, confirm, { until: 'unreachableTitle' }],
    }),
    dialog({
      id: 'ServerError',
      title: 'خطأ في الخادم: يبقى التأكيد',
      answers: { [PUT]: [fail(500, 'internal_error')] },
      steps: [...toSelected, next, confirm, { until: 'serverErrorText' }],
    }),
    dialog({
      id: 'Refused',
      title: 'رفض الخادم السبب: يعود إلى الحقل',
      answers: {
        [PUT]: [
          fail(400, 'validation_failed', { details: [{ path: 'body.reason', code: 'too_small' }] }),
        ],
      },
      steps: [...toSelected, next, confirm, { until: 'flagReasonMissing' }],
    }),
    page({
      id: 'Saved',
      title: 'تغيّرت الميزة: لعيادة مختارة',
      steps: [
        ...toSelected,
        next,
        confirm,
        { until: 'flagSavedText', values: { mode: 'selected' } },
      ],
    }),
    page({
      id: 'KilledAll',
      title: 'أُطفئت للجميع',
      steps: [
        change(ON_ALL),
        mode('مطفأة للجميع'),
        { fillIn: REASON, value: 'خطأ في المزامنة، أوقفت حتى الإصلاح' },
        next,
        confirm,
        { until: 'flagSavedText', values: { mode: 'off' } },
      ],
    }),
    page({
      id: 'Gone',
      title: 'لم تعد الميزة في الشيفرة',
      answers: {
        [PUT]: (request, world) => {
          world.adminA02.flags = world.adminA02.flags.filter(
            (f) => f.key !== request.params['key'],
          );
          return fail(404, 'not_found');
        },
      },
      steps: [...toSelected, next, confirm, { until: 'flagGoneTitle' }],
    }),
  ],
};
