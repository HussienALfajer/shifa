// Sheets of the Data display and Feedback groups.
import { CODES, OTP_URI, TABLE } from './data.ts';
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

export const DISPLAY: SheetSpec[] = [
  {
    name: 'Badge',
    group: 'Data display',
    density: false,
    desc: 'A small mark. Neutral, brand and outline follow the clinic; status and visit-queue tones are locked and always carry their icon.',
    play: 'Static.',
    blocks: () => [
      {
        label: 'Themed tones',
        items: [
          st({ children: 'مسودة' }, 'neutral'),
          st({ tone: 'brand', children: 'أسنان' }, 'brand'),
          st({ tone: 'outline', children: 'تأمين خاص' }, 'outline'),
          st({ tone: 'brand', icon: 'tooth', children: 'أسنان' }, 'brand with icon'),
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
        label: 'Sizes',
        items: [
          st({ tone: 'success', children: 'مدفوعة' }, 'sm · 24'),
          st({ tone: 'success', size: 'md', children: 'مدفوعة' }, 'md · 28'),
        ],
      },
    ],
  },
  {
    name: 'CountBadge',
    group: 'Data display',
    density: false,
    desc: 'Tabular Western digits, «99+» at most, nothing at 0, or a dot; named for screen readers.',
    play: 'Static.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st({ tone: 'brand', count: 5, label: '5 بالانتظار' }, 'brand · 5'),
          st({ tone: 'danger', count: 12, label: '12 رسالة غير مقروءة' }, 'danger · 12'),
          st({ count: 7, label: '7 زيارات' }, 'neutral · 7'),
          st({ count: 140, label: '140 زيارة' }, '140 → 99+'),
          st({ dot: true, tone: 'danger', label: 'إشعارات جديدة' }, 'dot'),
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
        label: 'Hues from the name',
        items: [
          'روان الجاسم',
          'بلال عطار',
          'خديجة النجار',
          'أحمد توران',
          'لينا يونس',
          'Salma Al-Masri',
        ].map((name) => st({ name }, name)),
      },
      {
        label: 'Group',
        items: [
          st(
            {
              label: 'الأطباء المناوبون',
              max: 3,
              people: SIZES.map(([name]) => ({ name })),
            },
            'three shown and «+2»',
          ),
        ],
      },
    ],
  },
  {
    name: 'Card',
    group: 'Data display',
    fill: true,
    desc: 'A white surface with header, body and footer; a link card opens its record from anywhere on it.',
    play: 'The footer buttons and the link card take presses and Tab.',
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
          st({ title: 'ملاحظة الاستقبال', body: ['يصل المريض مع مرافق.'] }, 'title and body'),
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
    desc: 'A dense grid of 48 px rows (32 compact) with a sticky header, the first column pinned at the logical start, sorting, selection and column visibility; one Tab stop and arrows in the reading direction.',
    play: 'Sort by a header, select rows, arrows move between cells.',
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
            'sorted, two rows selected',
          ),
          st({ 'aria-label': 'قائمة المرضى (بلا تحديد)', ...TABLE }, 'plain'),
          st(
            { 'aria-label': 'قائمة المرضى (تحميل)', ...TABLE, rows: [], loading: true },
            'loading',
          ),
          st(
            {
              'aria-label': 'قائمة المرضى (فارغة)',
              ...TABLE,
              rows: [],
              emptyTitle: 'لا مرضى بهذا الاسم',
            },
            'empty',
          ),
        ],
      },
    ],
  },
  {
    name: 'Spinner',
    group: 'Feedback',
    density: false,
    desc: 'The four jasmine petals of the logo lighting in turn, for waits without a known shape; shows after 400 ms (0 here), stays at least 400 ms, still under reduced motion; inside a busy Button it is the button’s mark.',
    play: 'Animates; nothing to press.',
    blocks: () => [
      {
        label: 'Sizes',
        items: [
          st({ size: 'sm', delay: 0 }, 'sm · 20'),
          st({ size: 'md', delay: 0 }, 'md · 24'),
          st({ size: 'lg', delay: 0 }, 'lg · 40'),
          st({ size: 'lg', delay: 0, showLabel: true }, 'lg with its label'),
        ],
      },
      {
        label: 'Inside other components',
        items: [
          st(
            { variant: 'primary', children: 'حفظ الزيارة', loading: true },
            'Button loading',
            null,
            { c: 'Button' },
          ),
          st({ label: 'رمز QR قيد التحميل' }, 'QrCode loading', null, { c: 'QrCode' }),
        ],
      },
    ],
  },
  {
    name: 'Skeleton',
    group: 'Feedback',
    fill: true,
    density: false,
    desc: 'Blocks, lines and circles on the raised surface for content of a known shape; a soft pulse, still under reduced motion.',
    play: 'Pulses; nothing to press.',
    blocks: () => [
      {
        label: 'Shapes',
        cols: 2,
        items: [
          st({ label: 'جارٍ تحميل بطاقة المريض', avatar: true, lines: 3 }, 'a person'),
          st({ label: 'جارٍ تحميل الصورة', block: true, lines: 1 }, 'a picture'),
          st({ label: 'جارٍ تحميل الملاحظات', lines: 5 }, 'text, five lines'),
        ],
      },
    ],
  },
];

export const FEEDBACK: SheetSpec[] = [
  {
    name: 'EmptyState',
    group: 'Feedback',
    fill: true,
    desc: 'The jasmine or star line drawing (or an icon for search and errors), a title, a description, up to two buttons.',
    play: 'The buttons take presses.',
    blocks: () => [
      {
        label: 'Kinds',
        cols: 2,
        items: [
          st(
            {
              art: 'jasmine',
              title: 'لا مواعيد اليوم',
              description: 'لم يُحجز أي موعد ليوم الأحد 22/11/2026.',
              actions: [{ label: 'موعد جديد', variant: 'primary' }],
            },
            'empty day (jasmine)',
          ),
          st(
            {
              icon: 'warning',
              title: 'تعذّر تحميل الفواتير',
              description: 'انقطع الاتصال بالخادم. ما حُفظ على الجهاز لم يضِع.',
              actions: [
                { label: 'إعادة المحاولة', variant: 'primary' },
                { label: 'التفاصيل', variant: 'ghost' },
              ],
            },
            'failed load, two buttons',
          ),
          st(
            {
              icon: 'magnifying-glass',
              title: 'لا نتائج لـ «زيد»',
              description: 'جرّب جزءاً من الاسم أو رقم الهاتف.',
            },
            'search without results',
          ),
          st(
            { art: 'star', title: 'لا وصفات بعد', description: 'تظهر الوصفات هنا بعد أول زيارة.' },
            'star art, no button',
          ),
        ],
      },
    ],
  },
  {
    name: 'Callout',
    group: 'Feedback',
    fill: true,
    desc: 'A message inside the page that stays while its cause holds; locked status colours with an icon, an optional title, one or two sentences, at most one button at the end of the line, no close button.',
    play: 'The button takes presses.',
    blocks: () => [
      {
        label: 'Tones',
        items: [
          st(
            {
              tone: 'info',
              icon: 'clock',
              title: 'خرجت تلقائياً',
              text: 'مرّت 30 دقيقة دون نشاط فأغلقنا الجلسة. ادخل من جديد لتتابع.',
            },
            'info, clock icon',
          ),
          st(
            {
              tone: 'success',
              title: 'دخلت برمز استرداد · بقي لديك 9 رموز',
              text: 'الرمز الذي استعملته أُلغي.',
            },
            'success',
          ),
          st(
            {
              tone: 'warning',
              icon: 'clock',
              title: 'توقّف الدخول بهذا الرقم مؤقتاً',
              text: 'بعد 5 محاولات خاطئة. يمكنك المحاولة بعد 14:59 (الساعة 10:42).',
            },
            'warning: a lock',
          ),
          st(
            {
              tone: 'danger',
              icon: 'wifi-slash',
              title: 'تعذّر الوصول إلى الخادم',
              text: 'تأكد من الاتصال بالإنترنت.',
              action: 'إعادة المحاولة',
            },
            'danger: no connection, one button',
          ),
          st({ text: 'تُحفظ التغييرات عند الضغط على «حفظ».' }, 'info, no title'),
        ].map((i) => ({ ...i, w: 600 })),
      },
    ],
  },
  {
    name: 'CodeList',
    group: 'Feedback',
    fill: true,
    desc: 'The ten recovery codes, shown once: numbered, monospaced, two columns left to right in both directions, «نسخ الكل» and «طباعة» (a light sheet with the person, the clinic and the date).',
    play: 'Press «نسخ الكل» (it confirms) or «طباعة» (opens the print sheet).',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            {
              codes: CODES,
              print: {
                title: 'رموز الاسترداد',
                who: 'لينا زيدان · 0930 024 973',
                date: '25/11/2026',
                note: 'احتفظ بهذه الورقة في مكان آمن. كل رمز يعمل مرة واحدة.',
              },
            },
            'with print',
          ),
          st({ codes: CODES }, 'copy only'),
        ],
      },
    ],
  },
  {
    name: 'QrCode',
    group: 'Feedback',
    density: false,
    desc: 'The authenticator’s otpauth:// link as a code a camera reads, drawn in the page; a white plate with ink modules in both themes, never mirrored; a spinner in its place while it loads.',
    play: 'Static.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st({ value: OTP_URI, label: 'رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة' }, 'ready'),
          st({ label: 'رمز QR قيد التحميل' }, 'loading'),
        ],
      },
    ],
  },
];
