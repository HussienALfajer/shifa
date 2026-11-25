// Playgrounds of the Navigation, Overlays, Data display and Feedback components (playground.ts
// has the rest and the rules).
import { flag, int, NONE, type Playground, pick, SOME_ICONS, text, VARIANTS } from './controls.ts';
import { ALERT, CODES, DIALOG, DRAWER, OTP_URI, PALETTE, TABLE } from './data.ts';

const TONES = [
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

export const MORE_PLAYGROUNDS: Record<string, Playground> = {
  Tabs: {
    base: {
      items: [
        { value: 'summary', label: 'الملخص', panel: 'آخر زيارة: 12/11/2026 · فحص دوري' },
        { value: 'visits', label: 'الزيارات', panel: 'ثلاث زيارات هذا العام' },
        { value: 'files', label: 'المرفقات', disabled: true },
      ],
    },
    controls: [text('aria-label', 'ملف المريض')],
  },
  SegmentedControl: {
    base: {
      items: [
        { value: 'day', label: 'اليوم' },
        { value: 'week', label: 'الأسبوع' },
        { value: 'month', label: 'الشهر' },
      ],
      defaultValue: 'day',
    },
    controls: [text('aria-label', 'عرض التقويم'), flag('disabled')],
  },
  Accordion: {
    base: {
      items: [
        { value: 'allergies', title: 'الحساسية والأمراض المزمنة', content: 'حساسية من البنسلين' },
        { value: 'medicines', title: 'الأدوية الحالية', content: 'أملوديبين 5 ملغ، مرة يومياً' },
      ],
    },
    controls: [flag('multiple')],
  },
  Pagination: {
    base: { pageSizes: [25, 50, 100] },
    controls: [pick('totalItems', [312, 40, 5000]), pick('form', ['numbers', 'compact'])],
  },
  CommandPalette: {
    base: { groups: PALETTE.groups, emptyText: PALETTE.emptyText },
    controls: [
      text('triggerLabel', PALETTE.triggerLabel),
      text('title', PALETTE.title),
      text('inputLabel', PALETTE.inputLabel),
    ],
  },
  Dialog: {
    base: {},
    controls: [
      text('triggerLabel', DIALOG.triggerLabel),
      pick('triggerVariant', VARIANTS, 'danger'),
      text('title', DIALOG.title),
      text('description', DIALOG.description),
      text('confirmLabel', DIALOG.confirmLabel),
      pick('confirmVariant', VARIANTS, 'danger'),
      text('cancelLabel', DIALOG.cancelLabel),
    ],
  },
  AlertDialog: {
    base: {},
    controls: [
      text('triggerLabel', ALERT.triggerLabel),
      text('title', ALERT.title),
      text('description', ALERT.description),
      pick('tone', ['danger', 'info']),
      text('actionLabel', ALERT.actionLabel),
      pick('actionVariant', ['danger', 'primary']),
      text('cancelLabel', ALERT.cancelLabel),
    ],
  },
  Drawer: {
    base: { fields: DRAWER.fields, cancelLabel: DRAWER.cancelLabel, saveLabel: DRAWER.saveLabel },
    controls: [
      text('triggerLabel', 'تعديل الموعد'),
      text('title', DRAWER.title),
      text('description', DRAWER.description),
      pick('side', ['end', 'start', 'bottom']),
    ],
  },
  Popover: {
    base: {},
    controls: [
      text('triggerLabel', 'ملاحظة سريعة'),
      text('title', 'ملاحظة للطبيب'),
      text('text', 'يفضّل موعداً بعد الظهر.'),
    ],
  },
  Tooltip: {
    base: {},
    controls: [
      text('content', 'إرسال تذكير عبر واتساب'),
      text('triggerLabel', 'إرسال تذكير'),
      pick('side', ['top', 'bottom']),
    ],
  },
  Badge: {
    base: {},
    controls: [
      text('children', 'مدفوعة'),
      pick('tone', TONES, 'success'),
      pick('size', ['sm', 'md']),
      pick('icon', SOME_ICONS),
    ],
  },
  CountBadge: {
    base: {},
    controls: [
      int('count', 5),
      text('label', '5 بالانتظار'),
      pick('tone', ['brand', 'neutral', 'danger']),
      flag('dot'),
    ],
  },
  Avatar: {
    base: {},
    controls: [text('name', 'غادة زيدان'), pick('size', ['md', 'xs', 'sm', 'lg', 'xl'])],
  },
  Card: {
    base: {
      body: ['المريض: مريض تجريبي', 'الطبيب: طبيب تجريبي'],
      footer: [{ label: 'سجّل الوصول', variant: 'primary' }, { label: 'تأجيل' }],
    },
    controls: [text('title', 'موعد اليوم'), text('description', 'الأحد 22/11/2026 · 10:30')],
  },
  DataTable: {
    base: { columns: TABLE.columns, rows: TABLE.rows },
    controls: [
      text('aria-label', 'قائمة المرضى'),
      flag('selectable', true),
      flag('loading'),
      text('emptyTitle', 'لا مرضى بهذا الاسم'),
    ],
  },
  Spinner: {
    base: { delay: 0 },
    controls: [
      pick('size', ['lg', 'md', 'sm']),
      flag('showLabel', true),
      text('label', 'جارٍ التحميل'),
    ],
  },
  Skeleton: {
    base: {},
    controls: [
      text('label', 'جارٍ تحميل بطاقة المريض'),
      flag('avatar', true),
      flag('block'),
      int('lines', 3),
    ],
  },
  EmptyState: {
    base: { actions: [{ label: 'موعد جديد', variant: 'primary' }] },
    controls: [
      text('title', 'لا مواعيد اليوم'),
      text('description', 'لم يُحجز أي موعد ليوم الأحد 22/11/2026.'),
      pick('art', ['jasmine', 'star', NONE]),
      pick('icon', [NONE, 'warning', 'magnifying-glass', 'calendar']),
      pick('size', ['panel', 'page']),
    ],
  },
  Callout: {
    base: {},
    controls: [
      pick('tone', ['info', 'success', 'warning', 'danger']),
      text('title', 'خرجت تلقائياً'),
      text('text', 'مرّت 30 دقيقة دون نشاط فأغلقنا الجلسة.'),
      pick('icon', [NONE, 'clock', 'info', 'warning', 'wifi-slash']),
      text('action', ''),
    ],
  },
  CodeList: {
    base: { codes: CODES },
    controls: [text('copyLabel', 'نسخ الكل'), text('copiedLabel', 'نُسخت الرموز')],
  },
  QrCode: {
    base: { value: OTP_URI },
    controls: [text('label', 'رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة')],
  },
};
