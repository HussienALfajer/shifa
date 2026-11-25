// Sheets of the Navigation group.
import { PALETTE } from './data.ts';
import { type SheetSpec, st } from './types.ts';

const TABS = [
  { value: 'summary', label: 'الملخص', panel: 'آخر زيارة: 12/11/2026 · فحص دوري' },
  { value: 'visits', label: 'الزيارات', panel: 'ثلاث زيارات هذا العام' },
  { value: 'prescriptions', label: 'الوصفات', panel: 'وصفة واحدة سارية' },
  { value: 'files', label: 'المرفقات', disabled: true },
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

export const NAVIGATION: SheetSpec[] = [
  {
    name: 'Tabs',
    group: 'Navigation',
    fill: true,
    desc: 'Views of one record; the selected tab green, heavier and underlined; a disabled tab is skipped.',
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
          st(
            {
              'aria-label': 'عرض التقويم',
              defaultValue: 'day',
              items: [
                { value: 'day', label: 'اليوم' },
                { value: 'week', label: 'الأسبوع' },
                { value: 'month', label: 'الشهر' },
              ],
            },
            'three options',
          ),
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
              items: [
                { value: 'day', label: 'اليوم' },
                { value: 'week', label: 'الأسبوع' },
              ],
            },
            'all disabled',
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
    play: 'Press a header, or Enter and Space; arrows move between headers.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            { items: SECTIONS, defaultValue: ['allergies'] },
            'one open, a count, a disabled section',
          ),
          st(
            { items: SECTIONS, defaultValue: ['allergies', 'medicines'], multiple: true },
            'multiple open',
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
    desc: 'Previous at the logical start, numbers with ellipses, the current one green, the page-size select and «عرض 51–75 من 312»; a compact form where it does not fit.',
    play: 'Press pages and arrows; choose another page size.',
    blocks: () => [
      {
        label: 'Forms',
        items: [
          st(
            { totalItems: 312, defaultPage: 3, pageSizes: [25, 50, 100] },
            'numbers with the page size',
            null,
            { w: 900 },
          ),
          st({ totalItems: 312, defaultPage: 1 }, 'first page', null, { w: 900 }),
          st({ totalItems: 312, defaultPage: 3, form: 'compact' }, 'compact form', null, {
            w: 420,
          }),
        ],
      },
    ],
  },
  {
    name: 'CommandPalette',
    group: 'Navigation',
    desc: 'One search over patients and actions in a 560 px panel near the top; an Arabic name is found whatever its alef form or diacritics, the match marked in gold.',
    play: 'Press «بحث», type «احمد» (finds أحمد) or «لينا»; arrows, Enter and Esc work.',
    blocks: () => [
      {
        label: 'Trigger',
        items: [st(PALETTE, 'opens the palette (the open views are beside this sheet)')],
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
