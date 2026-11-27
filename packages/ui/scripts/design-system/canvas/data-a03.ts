// Synthetic data of the A-03 sheets (sheets-a03.ts) and their playgrounds: patients, doctors and
// fields from the canvas's own invented names (data.ts). Never a real person.
import { DOCTORS, PATIENTS } from './data.ts';

export const name = (i: number) => PATIENTS[i]?.label ?? '';
const SEARCH_COLUMNS = [
  { header: 'رقم الملف', weight: 0.7 },
  { header: 'الجنس والعمر' },
  { header: 'الفرع', weight: 1.2 },
];
const row = (id: string, title: string, sexAge: string, branch: string, extra = {}) => ({
  id,
  title,
  href: `#patient-${id}`,
  cells: [{ text: id, kind: 'number' }, { text: sexAge }, { text: branch }],
  ...extra,
});

export const SEARCH = [
  row('1061', name(0), 'ذكر · 34 سنة', 'فرع الشهباء', {
    matches: [0, 1],
    details: [{ text: 'الاسم' }],
    current: true,
  }),
  row('1063', name(1), 'ذكر · ~9 سنوات', 'فرع الشهباء', {
    matches: [0, 1],
    details: [{ text: 'الاسم بتهجئة قريبة' }, { text: 'ابن صاحب الهاتف' }],
  }),
  row('1077', name(0), 'ذكر · 34 سنة', 'فرع الشهباء', {
    details: [{ badge: 'مدموج', tone: 'info' }, { text: 'الملف 1077 دُمج في الملف 1061' }],
  }),
  row('214', name(2), 'ذكر · 70 سنة', 'فرع إعزاز', {
    matches: [0, 1],
    details: [{ badge: 'مؤرشف', icon: 'archive' }, { text: 'أُرشف في 02/09/2026' }],
    dim: true,
  }),
];
export const LIST = {
  'aria-label': 'نتائج البحث',
  titleHeader: 'المريض',
  columns: SEARCH_COLUMNS,
};

export const FAMILY = [
  {
    id: '1012',
    title: name(4),
    details: [{ text: 'صاحب الهاتف' }, { text: 'ملف 1012' }, { text: '41 سنة' }],
    href: '#1012',
  },
  {
    id: '1043',
    title: name(5),
    details: [{ text: 'زوجة' }, { text: 'ملف 1043' }, { text: '34 سنة' }],
    href: '#1043',
  },
  {
    id: '1188',
    title: name(3),
    details: [{ text: 'ابنة' }, { text: 'ملف 1188' }, { text: '14 شهرًا' }],
    href: '#1188',
  },
];
export const CANDIDATES = [
  {
    id: '88',
    title: name(1),
    details: [{ text: 'ملف 88' }, { text: 'ذكر · 45 سنة' }, { text: 'الهاتف نفسه واسم قريب' }],
    action: { label: 'فتح الملف' },
  },
  {
    id: '1190',
    locked: true,
    title: 'ملف مشابه لدى طبيب آخر',
    details: [{ text: 'ملف 1190' }, { text: 'لا تظهر لك تفاصيله' }],
  },
  {
    id: '214',
    title: name(2),
    details: [
      { badge: 'مؤرشف', icon: 'archive' },
      { text: 'ملف 214' },
      { text: 'اطلب من المالك استعادته' },
    ],
    action: { label: 'فتح الملف' },
    dim: true,
  },
];
export const RECENT = [0, 3, 4, 5].map((i, at) => ({
  id: `r${String(i)}`,
  title: name(i),
  details: [
    { text: PATIENTS[i]?.value ?? '' },
    { text: ['قبل 5 دقائق', 'قبل 20 دقيقة', 'اليوم 09:40', 'أمس 17:05'][at] ?? '' },
  ],
  href: `#r${String(i)}`,
}));
export const TREATING = [
  { id: 'd1', title: DOCTORS[0]?.label ?? '', details: [{ text: 'أُضيفت عند التسجيل' }] },
  {
    id: 'd2',
    title: DOCTORS[1]?.label ?? '',
    details: [{ text: 'لم يعد في الفريق · يبقى على الملف' }],
    badge: { label: 'غير نشط' },
    dim: true,
  },
];
export const FIELD_ROWS = [
  {
    id: 'f1',
    icon: 'check-circle',
    title: 'جهة الإحالة',
    details: [{ badge: 'اختيار واحد' }, { badge: 'مطلوب', tone: 'brand' }, { text: 'يراه الكل' }],
    tools: [
      { icon: 'caret-up', label: 'نقل «جهة الإحالة» للأعلى', disabled: true },
      { icon: 'caret-down', label: 'نقل «جهة الإحالة» للأسفل' },
    ],
    action: { label: 'تعديل' },
  },
  {
    id: 'f2',
    icon: 'pencil',
    title: 'رقم بطاقة التأمين',
    details: [{ badge: 'نص' }, { badge: 'قابل للبحث', tone: 'outline', icon: 'magnifying-glass' }],
    tools: [
      { icon: 'caret-up', label: 'نقل «رقم بطاقة التأمين» للأعلى' },
      { icon: 'caret-down', label: 'نقل «رقم بطاقة التأمين» للأسفل', disabled: true },
    ],
    action: { label: 'تعديل' },
  },
];

export const FACTS = [
  { label: 'رقم الملف السابق', value: 'A-1180', kind: 'latin' },
  { label: 'سُجّل في', value: 'فرع الشهباء · 12/03/2026' },
  { label: 'الأطباء المعالجون', value: '2', kind: 'number' },
  { label: 'العائلة', value: '3 أفراد' },
];
export const RECORD_MENU = {
  menu: true,
  triggerLabel: 'المزيد',
  triggerIcon: 'dots',
  title: 'إجراءات الملف',
  items: [
    { value: 'merge', label: 'دمج مع ملف آخر', icon: 'users' },
    { value: 'print', label: 'طباعة البطاقة', icon: 'printer', disabled: true, hint: 'لاحقًا' },
    { separator: true },
    { value: 'archive', label: 'أرشفة الملف', icon: 'archive', danger: true },
  ],
};
export const HEADER = {
  title: name(0),
  idLabel: 'ملف',
  idValue: '1061',
  badges: [{ label: 'ذكر' }, { label: '34 سنة', icon: 'calendar' }],
  facts: FACTS,
  meta: `آخر تعديل 20/11/2026 بيد ${name(5)}`,
};

export const SECTIONS = [
  { id: 'ref', title: 'الإحالة', rows: [{ id: 'r1', label: 'جهة الإحالة', value: 'طبيب آخر' }] },
  {
    id: 'ins',
    title: 'التأمين',
    rows: [
      { id: 'i1', label: 'شركة التأمين', value: 'تأمين الشمال' },
      { id: 'i2', label: 'رقم بطاقة التأمين', value: '40017733', kind: 'latin' },
    ],
  },
  {
    id: 'w',
    title: 'الإعفاء',
    rows: [
      {
        id: 'w1',
        label: 'سبب الإعفاء من الرسوم',
        value: 'حالة اجتماعية',
        badge: { label: 'حساس', tone: 'warning', icon: 'eye' },
      },
      { id: 'w2', label: 'أفضل وقت للاتصال', value: '' },
    ],
  },
];
export const FLAT = [
  {
    id: 'flat',
    rows: [
      { id: 'a', label: 'جهة الإحالة', value: 'طبيب آخر' },
      {
        id: 'b',
        label: 'ملاحظة إدارية',
        value: 'يفضّل المواعيد بعد الظهر لأن عمله صباحًا، ويحضر مع ابنته غالبًا.',
      },
      { id: 'c', label: 'رسائل التذكير', value: 'نعم' },
    ],
  },
];

export const CHOICES = [
  { id: 'a', label: 'طبيب آخر', use: 'في 41 ملفًا' },
  { id: 'b', label: 'صيدلية', use: 'في 12 ملفًا' },
  { id: 'c', label: 'الأهل والمعارف', use: 'في 96 ملفًا' },
  { id: 'd', label: 'وسائل التواصل', use: 'في 30 ملفًا' },
  { id: 'e', label: 'جريدة', use: 'في ملفين', archived: true },
];
export const CHOICE_LIST = { label: 'خيارات «جهة الإحالة»', max: 250 };
