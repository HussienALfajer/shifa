// The sheets of the components A-02 added (A-02-01, approved by the owner 2026-11-27): UsageChart,
// MultiCombobox and PageBanner, every state of each, from the system's bundle. Synthetic data.
import { PATIENTS } from './data.ts';
import { type SheetSpec, st } from './types.ts';

const COUNTS = [
  6, 9, 11, 0, 0, 12, 14, 10, 13, 8, 0, 7, 15, 16, 12, 11, 9, 0, 13, 18, 21, 17, 14, 0, 0, 12, 15,
  19, 16, 14,
];
const SMALL = [
  0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1,
];

/** 30 Damascus days ending on 26/11/2026. */
export function usageDays(counts: number[]): { date: string; count: number }[] {
  const end = Date.UTC(2026, 10, 26);
  return counts.map((count, i) => ({
    date: new Date(end - (counts.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

export const USAGE = {
  'aria-label': 'آخر 30 يومًا',
  days: usageDays(COUNTS),
  unit: '{n} تسجيل دخول',
};
export const CLINICS = PATIENTS.map((p) => ({ value: p.value, label: `عيادة ${p.label}` }));
const MULTI = {
  label: 'العيادات المختارة',
  items: CLINICS,
  emptyMessage: 'لا عيادة بهذا الاسم',
  placeholder: 'ابحث عن عيادة',
};
const TWO = [CLINICS[0]?.value ?? '', CLINICS[4]?.value ?? ''];
export const ANNOUNCEMENTS = [
  'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
  'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
  'تدريب على جدول المواعيد الجديد يوم السبت 10:00 عبر الهاتف.',
];
const OWNER = {
  tone: 'warning',
  icon: 'eye',
  title: 'فريق شفاء يقرأ عيادتك الآن، للقراءة فقط.',
  text: 'السبب: مشكلة في الفروع لا تظهر للمالك · حتى 14:12',
  action: 'إنهاء الدخول',
};
const SUPPORT = {
  tone: 'support',
  title: 'دخول الدعم · للقراءة فقط',
  text: 'عيادة تجريبية بعرض المالك · حتى 14:12 (متبقٍّ 42 دقيقة)',
  action: 'إنهاء',
};

export const A02_SHEETS: SheetSpec[] = [
  {
    name: 'UsageChart',
    group: 'Data display',
    fill: true,
    layout: 'stack',
    desc: 'Daily counts of the last 30 days: bars in the brand colour, today in gold, a day without activity a thin line; a y-axis in quarters, the dashed gold daily average; time from left to right in both directions.',
    play: 'Hover or Tab to a bar for its Tooltip; Left and Right move between days, Home and End to the ends.',
    blocks: () => [
      {
        label: 'States',
        cols: 1,
        items: [
          st({ ...USAGE, 'aria-label': 'آخر 30 يومًا · 1' }, 'sign-ins: average 10.4, highest 21'),
          st(
            { ...USAGE, 'aria-label': 'آخر 30 يومًا · 2', days: usageDays(SMALL) },
            'a small clinic: whole steps, many empty days',
          ),
          st({ ...USAGE, 'aria-label': 'آخر 30 يومًا · 3', days: [] }, 'no data yet'),
          st({ ...USAGE, 'aria-label': 'آخر 30 يومًا · 4', days: [], loading: true }, 'loading'),
        ],
      },
    ],
  },
  {
    name: 'MultiCombobox',
    group: 'Forms',
    fill: true,
    desc: 'Several choices by search: chips with a named remove inside the field, Combobox’s folded word-start matching, the list open after each pick with a tick on the chosen.',
    play: 'Type «عب» and choose two; Backspace in the empty field removes the last chip.',
    open: [
      {
        suffix: 'OpenTyped',
        label: 'مفتوحة · «عب»',
        h: 560,
        cap: 'Open with «عب» typed and one chosen: its tick, the typed part in bold',
        p: {
          ...MULTI,
          defaultOpen: true,
          defaultInputValue: 'عب',
          defaultValue: [CLINICS[0]?.value ?? ''],
        },
      },
      {
        suffix: 'OpenNoMatch',
        label: 'مفتوحة · لا نتائج',
        h: 420,
        cap: 'Open with «زز» typed: nothing matches, the empty message',
        p: { ...MULTI, defaultOpen: true, defaultInputValue: 'زز' },
      },
    ],
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ ...MULTI, hint: 'ابحث بالاسم واختر عيادة أو أكثر.' }, 'empty, with its hint'),
          st(
            { ...MULTI, label: 'عيادات الإعلان', defaultValue: TWO, hint: 'مختارة: 2.' },
            'two chosen',
          ),
          st({ ...MULTI, label: 'عيادات الميزة', error: 'اختر عيادة واحدة على الأقل.' }, 'error'),
          st({ ...MULTI, label: 'العيادات', defaultValue: TWO, disabled: true }, 'disabled'),
        ],
      },
    ],
  },
  {
    name: 'PageBanner',
    group: 'Feedback',
    fill: true,
    layout: 'stack',
    desc: 'A strip above the top bar on every page: announcements in the info and warning colours, the owner’s notice that support is reading, the support session solid; icon and word, the text, at most one button, a pager, a close only where it can be hidden.',
    play: 'Page through the announcements with previous and next; close one.',
    blocks: () => [
      {
        label: 'Announcements',
        cols: 1,
        items: [
          st(
            {
              tone: 'warning',
              title: 'تنبيه:',
              text: ANNOUNCEMENTS[0],
              dismissible: true,
              'aria-label': 'تنبيه 1',
            },
            'warning',
          ),
          st(
            {
              tone: 'info',
              title: 'معلومة:',
              text: ANNOUNCEMENTS[1],
              dismissible: true,
              'aria-label': 'معلومة 1',
            },
            'information',
          ),
          st(
            {
              tone: 'info',
              title: 'معلومة:',
              texts: ANNOUNCEMENTS,
              index: 1,
              dismissible: true,
              'aria-label': 'معلومة 2',
            },
            'several in turn: «2 من 3»',
          ),
        ],
      },
      {
        label: 'Support (cannot be hidden)',
        cols: 1,
        items: [
          st({ ...OWNER, 'aria-label': 'دعم المالك 1' }, 'the owner’s notice, «إنهاء الدخول»'),
          st({ ...SUPPORT, 'aria-label': 'دخول الدعم 1' }, 'the support session, solid'),
        ],
      },
      {
        label: 'On a phone (under 430 px)',
        cols: 1,
        items: [
          st(
            {
              tone: 'warning',
              title: 'تنبيه:',
              text: ANNOUNCEMENTS[0],
              dismissible: true,
              'aria-label': 'تنبيه 2',
            },
            'the text on its line, the close under it',
            null,
            { w: 390 },
          ),
          st({ ...OWNER, 'aria-label': 'دعم المالك 2' }, 'the owner’s notice', null, { w: 390 }),
        ],
      },
    ],
  },
];
