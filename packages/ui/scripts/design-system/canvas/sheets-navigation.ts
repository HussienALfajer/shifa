// Sheets of the Navigation group.
import { PALETTE } from './data.ts';
import { type SheetSpec, st } from './types.ts';

const TABS = [
  { value: 'summary', label: 'الملخص', panel: 'آخر زيارة: 12/11/2026 · فحص دوري' },
  { value: 'visits', label: 'الزيارات', panel: 'ثلاث زيارات هذا العام' },
  { value: 'prescriptions', label: 'الوصفات', panel: 'وصفة واحدة سارية' },
  { value: 'files', label: 'المرفقات', disabled: true },
];

const MANY_TABS = [
  { value: 'summary', label: 'الملخص', panel: 'آخر زيارة: 12/11/2026' },
  { value: 'visits', label: 'الزيارات', panel: 'ثلاث زيارات' },
  { value: 'prescriptions', label: 'الوصفات', panel: 'وصفتان' },
  { value: 'labs', label: 'التحاليل', panel: 'تحليل دم' },
  { value: 'images', label: 'الصور الشعاعية', panel: 'صورة بانورامية' },
  { value: 'billing', label: 'الفواتير والمدفوعات', panel: 'فاتورة واحدة' },
  { value: 'notes', label: 'الملاحظات', panel: 'لا ملاحظات' },
];

const SECTIONS = [
  {
    value: 'allergies',
    title: 'الحساسية والأمراض المزمنة',
    content: 'حساسية من البنسلين · ارتفاع ضغط، منذ 2019',
  },
  { value: 'medicines', title: 'الأدوية الحالية', content: 'أملوديبين 5 ملغ، مرة يومياً' },
  {
    value: 'visits',
    title: 'الزيارات السابقة',
    badge: '4',
    content: 'آخر زيارة 12/11/2026 · فحص دوري',
  },
  { value: 'insurance', title: 'ملاحظات التأمين (غير متاحة)', content: 'لا تأمين', disabled: true },
];

const DAYS = [
  { value: 'day', label: 'اليوم' },
  { value: 'week', label: 'الأسبوع' },
  { value: 'month', label: 'الشهر' },
];

export const NAVIGATION: SheetSpec[] = [
  {
    name: 'Tabs',
    group: 'Navigation',
    fill: true,
    desc: 'Views of one record; the selected tab green, heavier and underlined; a disabled tab is skipped; too many tabs scroll sideways.',
    play: 'Press a tab, or arrows in the reading direction.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st(
            { 'aria-label': 'ملف المريض', defaultValue: 'summary', items: TABS },
            'first selected, a disabled tab',
            null,
            { w: 560 },
          ),
          st(
            { 'aria-label': 'ملف المريض 2', defaultValue: 'prescriptions', items: TABS },
            'another selected',
            null,
            { w: 560 },
          ),
          st(
            { 'aria-label': 'ملف المريض 3', defaultValue: 'summary', items: MANY_TABS },
            'seven tabs in 560 px: they scroll',
            null,
            { w: 560 },
          ),
        ],
      },
      {
        label: 'Interaction (one tab)',
        items: [
          st(
            { 'aria-label': 'ملف المريض 4', defaultValue: 'summary', items: TABS },
            'hover on the second',
            'hover',
            { w: 560, scope: { role: 'tablist', nth: 2 } },
          ),
          st(
            { 'aria-label': 'ملف المريض 5', defaultValue: 'summary', items: TABS },
            'keyboard focus on the selected',
            'focus',
            { w: 560, scope: { role: 'tablist', nth: 1 } },
          ),
        ],
      },
    ],
  },
  {
    name: 'SegmentedControl',
    group: 'Navigation',
    desc: 'One choice of two to five that switches a view at once; the chosen segment white, raised and heavier.',
    play: 'Press a segment, or arrows (they choose as they move).',
    blocks: () => [
      {
        label: 'States',
        items: [
          st({ 'aria-label': 'عرض التقويم', defaultValue: 'day', items: DAYS }, 'three options'),
          st(
            {
              'aria-label': 'حالة الزيارة',
              defaultValue: 'waiting',
              items: [
                { value: 'all', label: 'الكل', count: 18 },
                { value: 'waiting', label: 'بالانتظار', count: 5 },
                { value: 'room', label: 'في الغرفة', count: 1 },
                { value: 'done', label: 'انتهت', count: 12 },
              ],
            },
            'with counts',
          ),
          st(
            {
              'aria-label': 'طريقة العرض',
              defaultValue: 'list',
              items: [
                { value: 'list', label: 'قائمة', icon: 'list' },
                { value: 'cards', label: 'بطاقات', icon: 'users' },
                { value: 'map', label: 'خريطة', disabled: true },
              ],
            },
            'icons, a disabled option',
          ),
          st(
            {
              'aria-label': 'عرض التقويم (معطّل)',
              defaultValue: 'week',
              disabled: true,
              items: DAYS.slice(0, 2),
            },
            'all disabled',
          ),
        ],
      },
      {
        label: 'Interaction (one segment)',
        items: [
          st(
            { 'aria-label': 'عرض التقويم 2', defaultValue: 'day', items: DAYS },
            'hover on the second',
            'hover',
            { scope: 2 },
          ),
          st(
            { 'aria-label': 'عرض التقويم 3', defaultValue: 'day', items: DAYS },
            'keyboard focus on the chosen',
            'focus',
            { scope: 1 },
          ),
        ],
      },
    ],
  },
  {
    name: 'Accordion',
    group: 'Navigation',
    fill: true,
    desc: 'Sections of a record in one card; 48 px headers, the caret at the logical end turned over and the text heavier when open; one open at a time unless multiple.',
    play: 'Press a header, or Enter and Space; arrows move between headers; hover and focus show there.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ items: SECTIONS, defaultValue: [] }, 'all closed'),
          st(
            { items: SECTIONS, defaultValue: ['allergies'] },
            'one open, a count, a disabled section',
          ),
          st(
            { items: SECTIONS, defaultValue: ['allergies', 'medicines'], multiple: true },
            'multiple open',
          ),
          st(
            {
              items: [
                {
                  value: 'history',
                  title: 'التاريخ المرضي للعائلة من جهة الأب والأم والأخوة',
                  content:
                    'سكري عند الأب منذ 2010، ارتفاع ضغط عند الأم، لا أمراض وراثية معروفة عند الأخوة.',
                },
              ],
              defaultValue: ['history'],
            },
            'a long title and text',
          ),
        ],
      },
    ],
  },
  {
    name: 'Pagination',
    group: 'Navigation',
    fill: true,
    layout: 'stack',
    desc: 'Previous at the logical start, numbers with ellipses, the current one green, the page-size select and «عرض 51–75 من 312»; the compact form below 430 px of its own width (auto, the default).',
    play: 'Press pages and arrows; choose another page size.',
    blocks: () => [
      {
        label: 'Pages',
        items: [
          st(
            { totalItems: 312, defaultPage: 3, pageSizes: [25, 50, 100] },
            'page 3, with the page size',
            null,
            { w: 900 },
          ),
          st({ totalItems: 312, defaultPage: 1 }, 'first page: previous stops', null, { w: 900 }),
          st({ totalItems: 312, defaultPage: 7 }, 'middle: ellipses on both sides', null, {
            w: 900,
          }),
          st({ totalItems: 312, defaultPage: 13 }, 'last page: next stops', null, { w: 900 }),
          st({ totalItems: 10, defaultPage: 1 }, 'one page', null, { w: 900 }),
          st({ totalItems: 0, defaultPage: 1 }, 'no items', null, { w: 900 }),
        ],
      },
      {
        label: 'Forms',
        items: [
          st({ totalItems: 312, defaultPage: 3, form: 'auto' }, 'auto at 420 px: compact', null, {
            w: 420,
          }),
          st({ totalItems: 312, defaultPage: 3, form: 'compact' }, 'compact', null, { w: 420 }),
          st(
            { totalItems: 312, defaultPage: 3, hideSummary: true },
            'without the summary line',
            null,
            { w: 900 },
          ),
        ],
      },
    ],
  },
  {
    name: 'CommandPalette',
    group: 'Navigation',
    desc: 'One search over patients and actions in a 560 px panel near the top; an Arabic name is found whatever its alef form or diacritics, the match marked in gold.',
    play: 'Press «بحث», type «احمد» (finds أحمد) or «لينا»; type «زز» for the empty state; arrows, Enter and Esc work.',
    blocks: () => [
      {
        label: 'Trigger',
        items: [st(PALETTE, 'opens the palette (its open view is in Tweaks › View)')],
      },
    ],
    open: [
      {
        suffix: 'Open',
        label: 'مفتوحة',
        h: 760,
        p: { ...PALETTE, defaultOpen: true },
        cap: 'Open: patients and actions',
      },
    ],
  },
];
