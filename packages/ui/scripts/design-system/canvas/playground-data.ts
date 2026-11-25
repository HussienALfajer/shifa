// Synthetic data the playgrounds choose between (playground.ts, playground-more.ts).
import { FORM_REG } from './data.ts';

export const TONES = [
  'neutral',
  'brand',
  'outline',
  'success',
  'warning',
  'danger',
  'info',
  'queue-booked',
  'queue-confirmed',
  'queue-arrived',
  'queue-waiting',
  'queue-in-room',
  'queue-done',
  'queue-no-show',
  'queue-cancelled',
];

export const TABS = {
  three: [
    { value: 'summary', label: 'الملخص', panel: 'آخر زيارة: 12/11/2026 · فحص دوري' },
    { value: 'visits', label: 'الزيارات', panel: 'ثلاث زيارات هذا العام' },
    { value: 'files', label: 'المرفقات', disabled: true },
  ],
  many: [
    { value: 'summary', label: 'الملخص', panel: 'آخر زيارة: 12/11/2026' },
    { value: 'visits', label: 'الزيارات', panel: 'ثلاث زيارات' },
    { value: 'prescriptions', label: 'الوصفات', panel: 'وصفتان' },
    { value: 'labs', label: 'التحاليل', panel: 'تحليل دم' },
    { value: 'images', label: 'الصور الشعاعية', panel: 'صورة بانورامية' },
    { value: 'billing', label: 'الفواتير والمدفوعات', panel: 'فاتورة واحدة' },
    { value: 'notes', label: 'الملاحظات', panel: 'لا ملاحظات' },
  ],
};

export const SEGMENTS = {
  plain: [
    { value: 'day', label: 'اليوم' },
    { value: 'week', label: 'الأسبوع' },
    { value: 'month', label: 'الشهر' },
  ],
  counts: [
    { value: 'waiting', label: 'بالانتظار', count: 5 },
    { value: 'in-room', label: 'في الغرفة', count: 1 },
    { value: 'done', label: 'انتهت', count: 12 },
  ],
  icons: [
    { value: 'list', label: 'قائمة', icon: 'list' },
    { value: 'calendar', label: 'تقويم', icon: 'calendar' },
    { value: 'users', label: 'الأطباء', icon: 'users', disabled: true },
  ],
};

export const SECTIONS = [
  { value: 'allergies', title: 'الحساسية والأمراض المزمنة', content: 'حساسية من البنسلين' },
  { value: 'medicines', title: 'الأدوية الحالية', content: 'أملوديبين 5 ملغ، مرة يومياً' },
  { value: 'visits', title: 'الزيارات السابقة', badge: '4', content: 'آخر زيارة 12/11/2026' },
  { value: 'insurance', title: 'ملاحظات التأمين', content: 'لا تأمين', disabled: true },
];

export const TOAST_TYPES = ['success', 'info', 'warning', 'error', 'default'];

/** The registration form before a submit: its fields without their errors. */
export const FORM_CLEAN = FORM_REG.fields.map((entry) =>
  Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'error')),
);
