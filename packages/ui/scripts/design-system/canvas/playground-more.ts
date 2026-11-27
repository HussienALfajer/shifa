// Playgrounds of the Navigation, Overlays, Data display and Feedback components (playground.ts
// has the rest and the rules).
import {
  choose,
  flag,
  int,
  NONE,
  once,
  type Playground,
  pick,
  SOME_ICONS,
  text,
  VARIANTS,
} from './controls.ts';
import { ALERT, CODES, DIALOG, DRAWER, OTP_URI, PALETTE, TABLE } from './data.ts';
import { SECTIONS, SEGMENTS, TABS, TOAST_TYPES, TONES } from './playground-data.ts';

export const MORE_PLAYGROUNDS: Record<string, Playground> = {
  Tabs: {
    base: { 'aria-label': 'ملف المريض' },
    controls: [
      once(choose('items', TABS, { three: 'three tabs, one disabled', many: 'seven: scrolls' })),
      once(pick('defaultValue', ['summary', 'visits'])),
    ],
  },
  SegmentedControl: {
    base: { 'aria-label': 'عرض التقويم' },
    controls: [
      once(
        choose('items', SEGMENTS, { plain: 'plain', counts: 'with counts', icons: 'with icons' }),
      ),
      flag('disabled'),
    ],
    remountAll: true,
  },
  Accordion: {
    base: {},
    controls: [
      once(
        choose(
          'items',
          { all: SECTIONS, two: SECTIONS.slice(0, 2) },
          { all: 'four sections', two: 'two sections' },
        ),
      ),
      once(
        choose(
          'defaultValue',
          { none: [], first: ['allergies'], two: ['allergies', 'medicines'] },
          { none: 'all closed', first: 'first open', two: 'two open' },
        ),
      ),
      once(flag('multiple')),
    ],
  },
  Pagination: {
    base: { pageSizes: [25, 50, 100] },
    controls: [
      once(pick('totalItems', [312, 40, 5000, 10, 0])),
      once(pick('defaultPage', [1, 3, 7, 13])),
      pick('form', ['auto', 'numbers', 'compact']),
      flag('hideSummary'),
    ],
    scenarios: [
      { label: 'First page', set: { totalItems: 312, defaultPage: 1 } },
      { label: 'Middle', set: { totalItems: 312, defaultPage: 7 } },
      { label: 'Last page', set: { totalItems: 312, defaultPage: 13 } },
      { label: 'One page', set: { totalItems: 10, defaultPage: 1 } },
    ],
  },
  CommandPalette: {
    base: { groups: PALETTE.groups },
    controls: [
      text('triggerLabel', PALETTE.triggerLabel),
      text('title', PALETTE.title),
      text('inputLabel', PALETTE.inputLabel),
      text('emptyText', PALETTE.emptyText),
      once(flag('defaultOpen')),
    ],
    scenarios: [{ label: 'Open', set: { defaultOpen: true } }],
  },
  Dialog: {
    base: {},
    controls: [
      text('triggerLabel', DIALOG.triggerLabel),
      pick('triggerVariant', VARIANTS, 'danger'),
      pick('triggerIcon', SOME_ICONS, 'trash'),
      text('title', DIALOG.title),
      text('description', DIALOG.description),
      text('confirmLabel', DIALOG.confirmLabel),
      pick('confirmVariant', VARIANTS, 'danger'),
      text('cancelLabel', DIALOG.cancelLabel),
      flag('triggerDisabled'),
      once(flag('defaultOpen')),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true } },
      {
        label: 'Ordinary confirmation',
        set: {
          triggerLabel: 'تأجيل الموعد',
          triggerVariant: 'secondary',
          triggerIcon: 'clock',
          title: 'تأجيل الموعد إلى الخميس؟',
          description: 'الخميس 26/11/2026 الساعة 11:00. يصل المريضَ إشعار بالموعد الجديد.',
          confirmLabel: 'تأجيل',
          confirmVariant: 'primary',
        },
      },
    ],
  },
  AlertDialog: {
    base: { errorText: 'تعذّر الحذف. حاول مرة أخرى.' },
    controls: [
      text('triggerLabel', ALERT.triggerLabel),
      pick('triggerIcon', SOME_ICONS, 'trash'),
      text('title', ALERT.title),
      text('description', ALERT.description),
      pick('tone', ['danger', 'info']),
      text('actionLabel', ALERT.actionLabel),
      pick('actionVariant', ['danger', 'primary']),
      text('cancelLabel', ALERT.cancelLabel),
      pick('actionResult', ['success', 'error', 'pending']),
      flag('triggerDisabled'),
      once(flag('defaultOpen')),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true } },
      { label: 'The action fails', set: { defaultOpen: true, actionResult: 'error' } },
      { label: 'Info', set: { tone: 'info', actionVariant: 'primary', triggerIcon: '' } },
    ],
  },
  Drawer: {
    base: { fields: DRAWER.fields },
    controls: [
      text('triggerLabel', 'تعديل الموعد'),
      pick('triggerIcon', SOME_ICONS, 'pencil'),
      text('title', DRAWER.title),
      text('description', DRAWER.description),
      pick('side', ['end', 'start', 'bottom']),
      pick('size', ['default', 'wide']),
      text('cancelLabel', DRAWER.cancelLabel),
      text('saveLabel', DRAWER.saveLabel),
      flag('triggerDisabled'),
      once(flag('defaultOpen')),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true } },
      { label: 'From the bottom', set: { defaultOpen: true, side: 'bottom' } },
      { label: 'Wide', set: { defaultOpen: true, size: 'wide' } },
    ],
  },
  Popover: {
    base: {},
    controls: [
      text('triggerLabel', 'ملاحظة سريعة'),
      pick('triggerIcon', SOME_ICONS),
      pick('triggerVariant', VARIANTS, 'secondary'),
      text('title', 'ملاحظة للطبيب'),
      text('text', 'يفضّل موعداً بعد الظهر.'),
      flag('triggerDisabled'),
      once(flag('defaultOpen')),
    ],
    scenarios: [{ label: 'Open', set: { defaultOpen: true } }],
  },
  Tooltip: {
    base: {},
    controls: [
      text('content', 'إرسال تذكير عبر واتساب'),
      text('triggerLabel', 'إرسال تذكير'),
      pick('triggerIcon', SOME_ICONS, 'phone'),
      pick('side', ['top', 'bottom']),
      flag('disabled'),
      once(flag('defaultOpen')),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true } },
      { label: 'Icon button', set: { triggerLabel: '', triggerIcon: 'phone' } },
    ],
  },
  Toast: {
    base: { triggerLabel: 'إظهار الإشعار' },
    controls: [
      pick('type', TOAST_TYPES),
      text('title', 'حُفظت الوصفة'),
      text('description', 'ثلاثة أدوية'),
      text('actionLabel', ''),
      flag('autoDismiss'),
    ],
    // The card shows its toast when it mounts: every change shows the new one.
    remountAll: true,
    scenarios: [
      {
        label: 'Saved',
        set: { type: 'success', title: 'حُفظت الوصفة', description: 'ثلاثة أدوية' },
      },
      {
        label: 'With undo',
        set: { type: 'info', title: 'نُقل الموعد إلى الخميس 26/11', actionLabel: 'تراجع' },
      },
      {
        label: 'Error',
        set: { type: 'error', title: 'تعذّر حفظ الفاتورة', description: 'انقطع الاتصال.' },
      },
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
      int('max', 99),
      text('label', '5 بالانتظار'),
      pick('tone', ['brand', 'neutral', 'danger']),
      flag('dot'),
    ],
  },
  Avatar: {
    base: {},
    controls: [
      text('name', 'غادة زيدان'),
      pick('size', ['md', 'xs', 'sm', 'lg', 'xl']),
      choose(
        'people',
        {
          one: undefined,
          group: [
            { name: 'غادة زيدان' },
            { name: 'موسى الشيخ' },
            { name: 'نور الرفاعي' },
            { name: 'فاطمة الحسن' },
            { name: 'سليم صباغ' },
          ],
        },
        { one: 'one person', group: 'a group of five' },
      ),
      int('max', 3),
      text('label', 'الأطباء المناوبون'),
    ],
  },
  Card: {
    base: { body: ['المريض: مريض تجريبي', 'الطبيب: طبيب تجريبي'] },
    controls: [
      text('title', 'موعد اليوم'),
      text('description', 'الأحد 22/11/2026 · 10:30'),
      text('href', ''),
      choose(
        'actions',
        { none: undefined, one: [{ label: 'تعديل', variant: 'ghost' }] },
        { none: 'none', one: 'one' },
      ),
      choose(
        'footer',
        { two: [{ label: 'سجّل الوصول', variant: 'primary' }, { label: 'تأجيل' }], none: undefined },
        { two: 'two buttons', none: 'none' },
      ),
    ],
    scenarios: [
      { label: 'Link card', set: { href: '#patient-1042', footer: 'none' } },
      { label: 'Body only', set: { title: '', footer: 'none' } },
    ],
  },
  DataTable: {
    base: { columns: TABLE.columns },
    controls: [
      choose('rows', { some: TABLE.rows, none: [] }, { some: 'rows', none: 'no rows' }),
      text('aria-label', 'قائمة المرضى'),
      flag('selectable', true),
      flag('loading'),
      pick('loadingRows', [5, 3, 8]),
      text('emptyTitle', 'لا مرضى بهذا الاسم'),
      text('emptyDescription', ''),
      pick('emptyIcon', [NONE, 'magnifying-glass', 'warning', 'wifi-slash']),
    ],
    scenarios: [
      { label: 'Loading', set: { loading: true } },
      { label: 'No match', set: { rows: 'none', emptyIcon: 'magnifying-glass' } },
      {
        label: 'Error',
        set: {
          rows: 'none',
          emptyTitle: 'تعذّر تحميل المرضى',
          emptyDescription: 'تحقّق من الاتصال ثم أعد المحاولة.',
          emptyIcon: 'wifi-slash',
        },
      },
    ],
  },
  Spinner: {
    base: {},
    controls: [
      pick('size', ['lg', 'md', 'sm']),
      flag('showLabel', true),
      text('label', 'جارٍ التحميل'),
      flag('active', true),
      once(pick('delay', [400, 0, 1000])),
    ],
    scenarios: [
      { label: 'As in the app (400 ms)', set: { delay: 400, active: true } },
      { label: 'Stopped', set: { active: false } },
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
    base: {},
    controls: [
      text('title', 'لا مواعيد اليوم'),
      text('description', 'لم يُحجز أي موعد ليوم الأحد 22/11/2026.'),
      pick('art', ['jasmine', 'star', NONE]),
      pick('icon', [NONE, 'warning', 'magnifying-glass', 'calendar']),
      pick('size', ['panel', 'page']),
      choose(
        'actions',
        {
          one: [{ label: 'موعد جديد', variant: 'primary' }],
          two: [{ label: 'إعادة المحاولة', variant: 'primary' }, { label: 'الدعم' }],
          none: undefined,
        },
        { one: 'one button', two: 'two buttons', none: 'none' },
      ),
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
    controls: [
      text('copyLabel', 'نسخ الكل'),
      text('copiedLabel', 'نُسخت الرموز العشرة'),
      text('printLabel', 'طباعة'),
      choose(
        'print',
        {
          sheet: {
            title: 'رموز الاسترداد لحساب شفاء',
            who: 'مستخدم تجريبي · عيادة الياسمين',
            date: '22/11/2026',
            note: 'احفظ هذه الورقة في مكان آمن.',
          },
          none: undefined,
        },
        { sheet: 'with print', none: 'copy only' },
      ),
    ],
  },
  QrCode: {
    base: {},
    controls: [
      choose(
        'value',
        { ready: OTP_URI, loading: undefined },
        { ready: 'ready', loading: 'loading' },
      ),
      text('label', 'رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة'),
    ],
  },
};
