// Sheets of the Data display group (the Feedback group is sheets-feedback.ts).
import { TABLE } from './data.ts';
import { type SheetSpec, st } from './types.ts';

const QUEUE: [string, string][] = [
  ['booked', 'محجوز'],
  ['confirmed', 'مؤكَّد'],
  ['arrived', 'وصل'],
  ['waiting', 'بالانتظار'],
  ['in-room', 'في الغرفة'],
  ['done', 'انتهت'],
  ['no-show', 'لم يحضر'],
  ['cancelled', 'ملغى'],
];
const SIZES: [string, string, string][] = [
  ['غادة زيدان', 'xs', 'xs · 24'],
  ['موسى الشيخ', 'sm', 'sm · 32'],
  ['نور الرفاعي', 'md', 'md · 40'],
  ['فاطمة الحسن', 'lg', 'lg · 56'],
  ['سليم صباغ', 'xl', 'xl · 80'],
];
const LINK_CARD = {
  title: 'ملف مريض تجريبي',
  description: 'ملف رقم P-10482',
  href: '#patient',
  body: ['رصيد مستحق 45,000 ل.س'],
};
/** Enough rows to scroll the table: the sticky header and pinned column show their shadows. */
const MANY_ROWS = Array.from({ length: 4 }, (_, n) =>
  TABLE.rows.map((row) => ({ ...row, file: `${row.file}${String(n)}` })),
).flat();

export const DISPLAY: SheetSpec[] = [
  {
    name: 'Badge',
    group: 'Data display',
    density: false,
    desc: 'A small mark. Neutral, brand and outline follow the clinic; status and visit-queue tones are locked and always carry their icon; a long word is cut with an ellipsis.',
    play: 'Static.',
    blocks: () => [
      {
        label: 'Themed tones',
        items: [
          st({ children: 'مسودة' }, 'neutral'),
          st({ tone: 'brand', children: 'أسنان' }, 'brand'),
          st({ tone: 'outline', children: 'تأمين خاص' }, 'outline'),
          st({ tone: 'brand', icon: 'tooth', children: 'أسنان' }, 'brand with icon'),
          st({ tone: 'outline', icon: 'calendar', children: 'متابعة' }, 'outline with icon'),
        ],
      },
      {
        label: 'Status (locked)',
        items: [
          st({ tone: 'success', children: 'مدفوعة' }, 'success'),
          st({ tone: 'warning', children: 'جزئية' }, 'warning'),
          st({ tone: 'danger', children: 'ملغاة' }, 'danger'),
          st({ tone: 'info', children: 'مرسلة' }, 'info'),
        ],
      },
      {
        label: 'Visit queue (locked)',
        items: QUEUE.map(([t, w]) => st({ tone: `queue-${t}`, children: w }, t)),
      },
      {
        label: 'Sizes and long text',
        items: [
          st({ tone: 'success', children: 'مدفوعة' }, 'sm · 24'),
          st({ tone: 'success', size: 'md', children: 'مدفوعة' }, 'md · 28'),
          st({ tone: 'brand', size: 'md', icon: 'tooth', children: 'أسنان' }, 'md with icon'),
          st(
            { tone: 'info', children: 'مرسلة إلى شركة التأمين للموافقة المسبقة' },
            'cut in 160 px',
            null,
            { w: 160 },
          ),
        ],
      },
    ],
  },
  {
    name: 'CountBadge',
    group: 'Data display',
    density: false,
    desc: 'Tabular Western digits, «99+» at most (or another max), nothing at 0, or a dot; named for screen readers.',
    play: 'Static.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st({ tone: 'brand', count: 5, label: '5 بالانتظار' }, 'brand · 5'),
          st({ tone: 'danger', count: 12, label: '12 رسالة غير مقروءة' }, 'danger · 12'),
          st({ count: 7, label: '7 زيارات' }, 'neutral · 7'),
          st({ count: 140, label: '140 زيارة' }, '140 → 99+'),
          st({ count: 14, max: 9, tone: 'brand', label: '14 بالانتظار' }, 'max 9: 14 → 9+'),
          st({ dot: true, tone: 'danger', label: 'إشعارات جديدة' }, 'danger dot'),
          st({ dot: true, tone: 'brand', label: 'تحديث جديد' }, 'brand dot'),
          st({ count: 0, label: 'لا رسائل' }, '0 → nothing'),
        ],
      },
    ],
  },
  {
    name: 'Avatar',
    group: 'Data display',
    density: false,
    desc: 'A picture, or the first letters of the first and last names on one of six hues picked from the name; sizes 24 to 80; a group overlaps toward the logical end and ends with «+3».',
    play: 'Static.',
    blocks: () => [
      { label: 'Sizes', items: SIZES.map(([name, size, cap]) => st({ name, size }, cap)) },
      {
        label: 'Hues and initials from the name',
        items: [
          ['روان الجاسم', 'two names'],
          ['بلال عطار', 'two names'],
          ['خديجة النجار', '«ال» skipped'],
          ['د. أحمد توران', 'a title skipped'],
          ['لينا', 'one name: one letter'],
          ['Salma Al-Masri', 'Latin'],
        ].map(([name, cap]) => st({ name }, `${String(name)} · ${String(cap)}`)),
      },
      {
        label: 'Groups',
        items: [
          st(
            {
              label: 'الأطباء المناوبون',
              max: 3,
              people: SIZES.map(([name]) => ({ name })),
            },
            'three shown and «+2»',
          ),
          st(
            {
              label: 'فريق الاستقبال',
              max: 4,
              size: 'sm',
              people: SIZES.map(([name]) => ({ name })),
            },
            'sm, four shown and «+1»',
          ),
          st(
            {
              label: 'الممرضون',
              size: 'lg',
              people: SIZES.slice(0, 3).map(([name]) => ({ name })),
            },
            'lg, all shown',
          ),
        ],
      },
    ],
  },
  {
    name: 'Card',
    group: 'Data display',
    fill: true,
    desc: 'A white surface with header, body and footer; buttons may sit at the end of the header; a link card opens its record from anywhere on it; a body-only card for a figure.',
    play: 'The buttons and the link card take presses and Tab.',
    blocks: () => [
      {
        label: 'Kinds',
        cols: 2,
        items: [
          st(
            {
              title: 'موعد اليوم',
              description: 'الأحد 22/11/2026 · 10:30',
              body: ['المريض: مريض تجريبي', 'الطبيب: طبيب تجريبي'],
              footer: [{ label: 'سجّل الوصول', variant: 'primary' }, { label: 'تأجيل' }],
            },
            'full card',
          ),
          st(LINK_CARD, 'link card'),
          st(
            {
              title: 'بيانات الاتصال',
              description: 'آخر تعديل 20/11/2026',
              actions: [{ label: 'تعديل', variant: 'ghost' }],
              body: ['الهاتف: 09xx xxx 973', 'العنوان: حلب، الجميلية'],
            },
            'header buttons',
          ),
          st({ title: 'ملاحظة الاستقبال', body: ['يصل المريض مع مرافق.'] }, 'title and body'),
          st({ body: ['مواعيد اليوم: 18', 'بالانتظار: 5'] }, 'body only (a figure)'),
          st(
            {
              title: 'ملاحظات الطبيب عن الزيارة السابقة ومتابعة العلاج',
              description: 'كتبها د. طبيب تجريبي يوم الخميس 12/11/2026 الساعة 11:40',
              body: [
                'يُتابع العلاج بالمضاد الحيوي سبعة أيام، ويُعاد تقييم الألم في الزيارة القادمة.',
              ],
            },
            'long text',
          ),
        ],
      },
      {
        label: 'Link card interaction',
        cols: 2,
        items: [st(LINK_CARD, 'hover', 'hover'), st(LINK_CARD, 'keyboard focus', 'focus')],
      },
    ],
  },
  {
    name: 'DataTable',
    group: 'Data display',
    fill: true,
    layout: 'stack',
    desc: 'A dense grid of 48 px rows (32 compact) with a sticky header, the first column pinned at the logical start, sorting, selection and column visibility; one Tab stop and arrows in the reading direction; an empty state for no match or an error.',
    play: 'Sort by a header, select rows, open «الأعمدة», arrows move between cells; the long table scrolls.',
    blocks: () => [
      {
        label: 'States',
        cols: 1,
        items: [
          st(
            {
              'aria-label': 'قائمة المرضى',
              selectable: true,
              defaultSelected: ['1', '3'],
              defaultSort: { columnId: 'visit', direction: 'descending' },
              ...TABLE,
            },
            'sorted, two rows selected (select-all shows some)',
          ),
          st({ 'aria-label': 'قائمة المرضى (بلا تحديد)', ...TABLE }, 'plain'),
          st(
            {
              'aria-label': 'قائمة المرضى (أعمدة مخفية)',
              ...TABLE,
              defaultHiddenColumns: [TABLE.columns.at(-1)?.id ?? ''],
            },
            'a column hidden from «الأعمدة»',
          ),
          st(
            {
              'aria-label': 'قائمة المرضى (تحميل)',
              ...TABLE,
              rows: [],
              loading: true,
              loadingRows: 3,
            },
            'loading, three skeleton rows',
          ),
          st(
            {
              'aria-label': 'قائمة المرضى (فارغة)',
              ...TABLE,
              rows: [],
              emptyTitle: 'لا مرضى بهذا الاسم',
              emptyDescription: 'جرّب جزءاً من الاسم أو رقم الهاتف.',
              emptyIcon: 'magnifying-glass',
            },
            'no match',
          ),
          st(
            {
              'aria-label': 'قائمة المرضى (خطأ)',
              ...TABLE,
              rows: [],
              emptyTitle: 'تعذّر تحميل المرضى',
              emptyDescription: 'تحقّق من الاتصال ثم أعد المحاولة.',
              emptyIcon: 'wifi-slash',
              emptyActions: [{ label: 'إعادة المحاولة', variant: 'primary' }],
            },
            'error, a way out',
          ),
        ],
      },
      {
        label: 'Long list',
        cols: 1,
        items: [
          st(
            { 'aria-label': 'قائمة المرضى (طويلة)', ...TABLE, rows: MANY_ROWS, selectable: true },
            'more rows than fit: scroll it in Play (sticky header, pinned column)',
          ),
        ],
      },
    ],
  },
];
