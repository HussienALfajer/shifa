// Sheets of the Feedback group.
import { CODES, OTP_URI } from './data.ts';
import { type SheetSpec, st } from './types.ts';

const PRINT = {
  title: 'رموز الاسترداد',
  who: 'مستخدم تجريبي · عيادة الياسمين',
  date: '25/11/2026',
  note: 'احتفظ بهذه الورقة في مكان آمن. كل رمز يعمل مرة واحدة.',
};

export const FEEDBACK: SheetSpec[] = [
  {
    name: 'Spinner',
    group: 'Feedback',
    density: false,
    desc: 'The four jasmine petals of the logo lighting in turn, for waits without a known shape; in the app it shows after 400 ms and stays at least 400 ms, so quick loads never flash; still under reduced motion; inside a busy Button it is the button’s mark.',
    play: 'Animates. In the playground, choose a delay and switch «active» to see the 400 ms rules.',
    blocks: () => [
      {
        label: 'Sizes (shown at once here)',
        items: [
          st({ size: 'sm', delay: 0 }, 'sm · 20'),
          st({ size: 'md', delay: 0 }, 'md · 24'),
          st({ size: 'lg', delay: 0 }, 'lg · 40'),
          st({ size: 'lg', delay: 0, showLabel: true }, 'lg with its label'),
        ],
      },
      {
        label: 'Timing and colour',
        items: [
          st({ size: 'md' }, 'delay 400 ms (the app’s): appears after it'),
          st({ size: 'md', delay: 0, active: false }, 'active false: nothing'),
          st({ size: 'md', delay: 0, className: 'text-status-danger-fg' }, 'the colour around it'),
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
          st({ icon: 'printer', label: 'طباعة', loading: true }, 'IconButton loading', null, {
            c: 'IconButton',
          }),
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
          st({ label: 'جارٍ تحميل السطر', lines: 1 }, 'one line'),
          st({ label: 'جارٍ تحميل الشخص', avatar: true, lines: 0 }, 'a circle and two short lines'),
          st({ label: 'جارٍ تحميل المخطط', block: true, lines: 0 }, 'a block alone'),
        ],
      },
    ],
  },
  {
    name: 'EmptyState',
    group: 'Feedback',
    fill: true,
    desc: 'The jasmine or star line drawing (or an icon for search and errors), a title, a description, up to two buttons; panel size inside a card or table, page size for a whole empty screen.',
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
          st({ title: 'لا ملاحظات' }, 'title only'),
        ],
      },
      {
        label: 'Page size',
        cols: 1,
        items: [
          st(
            {
              art: 'jasmine',
              size: 'page',
              title: 'لا مرضى بعد',
              description: 'سجّل أول مريض لتبدأ بحجز المواعيد.',
              actions: [{ label: 'تسجيل مريض', variant: 'primary' }, { label: 'استيراد من ملف' }],
            },
            'a whole empty screen',
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
          st(
            {
              tone: 'warning',
              title: 'العيادة موقوفة مؤقتاً',
              text: 'لم يُجدَّد الاشتراك منذ 30 يوماً. تبقى البيانات محفوظة، ويعود الحجز من صفحة العيادة بعد التجديد مباشرة.',
              action: 'تجديد الاشتراك',
            },
            'two lines and a button',
          ),
        ].map((i) => ({ ...i, w: 600 })),
      },
    ],
  },
  {
    name: 'CodeList',
    group: 'Feedback',
    fill: true,
    desc: 'The ten recovery codes, shown once: numbered, monospaced, two columns left to right in both directions, «نسخ الكل» and «طباعة» (a light sheet with the person, the clinic and the date).',
    play: 'Press «نسخ الكل» (it confirms for 3 s; the canvas may refuse the clipboard) or «طباعة» (opens the print sheet).',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ codes: CODES, print: PRINT }, 'with print'),
          st({ codes: CODES }, 'copy only'),
          st(
            {
              codes: CODES,
              label: 'Recovery codes',
              copyLabel: 'Copy all',
              copiedLabel: 'Copied',
              printLabel: 'Print',
              print: { ...PRINT, title: 'Recovery codes', who: 'Test user · Jasmine Clinic' },
            },
            'English',
            null,
            { dir: 'ltr' },
          ),
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
