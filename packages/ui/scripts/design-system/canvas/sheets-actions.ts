// Sheets of the Foundations and Actions groups.
import { ICONS, MENU_GROUPS, MENU_ITEMS } from './data.ts';
import { compact, interact, type SheetSpec, st } from './types.ts';

const BUTTONS: [string, string][] = [
  ['primary', 'حفظ الزيارة'],
  ['secondary', 'طباعة'],
  ['ghost', 'تعديل'],
  ['danger', 'إلغاء الموعد'],
];

const TOOL_GROUPS = [
  [
    { label: 'طباعة', icon: 'printer' },
    { label: 'تصدير', icon: 'file-text' },
  ],
  [
    { label: 'الأحدث أولاً', pressed: true },
    { label: 'دمج', disabled: true },
    { label: 'الأعمدة', icon: 'list' },
  ],
];

export const ACTIONS: SheetSpec[] = [
  {
    name: 'Icon',
    group: 'Foundations',
    density: false,
    desc: 'The curated Solar Broken set (and the Healthicons tooth) by name, in the text colour. 20 px in rows and controls, 24 px in navigation and cards; directional icons mirror in RTL.',
    play: 'Static: icons are never interactive on their own.',
    blocks: () => [
      {
        label: `All ${String(ICONS.length)} icons · sm 20 px`,
        cols: 6,
        items: ICONS.map((n) => st({ name: n }, n)),
      },
      {
        label: 'md 24 px',
        items: ['house', 'calendar', 'users', 'bell', 'gear', 'stethoscope', 'tooth'].map((n) =>
          st({ name: n, size: 'md' }, n),
        ),
      },
      {
        label: 'Direction: the same icons in RTL and LTR',
        items: [
          st({ name: 'arrow-forward', size: 'md' }, 'forward · RTL'),
          st({ name: 'arrow-forward', size: 'md' }, 'forward · LTR', null, { dir: 'ltr' }),
          st({ name: 'caret-back', size: 'md' }, 'back · RTL'),
          st({ name: 'caret-back', size: 'md' }, 'back · LTR', null, { dir: 'ltr' }),
          st({ name: 'clock', size: 'md' }, 'clock never mirrors'),
        ],
      },
      {
        label: 'Named icon',
        items: [st({ name: 'warning', size: 'md', label: 'تحذير' }, 'label: read aloud')],
      },
    ],
  },
  {
    name: 'Button',
    group: 'Actions',
    layout: 'stack',
    desc: 'Primary (one per view), secondary (the default), ghost, danger (brick, never red); sm, md, lg; an icon on the logical start. Loading keeps its label and focus and shows the Spinner of the system.',
    play: 'Press, Tab, Enter and Space work; hover, pressed and focus columns are fixed for display.',
    blocks: (d) => [
      {
        label: 'Variants × states',
        matrix: {
          cols: ['rest', 'hover', 'pressed', 'keyboard focus', 'disabled', 'loading'],
          rows: BUTTONS.map(([variant, children]) => ({
            head: variant,
            cells: [
              st({ variant, children }),
              st({ variant, children }, null, 'hover'),
              st({ variant, children }, null, 'pressed'),
              st({ variant, children }, null, 'focus'),
              st({ variant, children, disabled: true }),
              st({ variant, children, loading: true }),
            ],
          })),
        },
      },
      {
        label: 'Sizes',
        items: [
          st(
            { variant: 'primary', size: 'sm', children: 'حجز', startIcon: 'calendar-plus' },
            compact(d) ? 'sm · 28' : 'sm · 36',
          ),
          st(
            { variant: 'primary', size: 'md', children: 'حجز موعد', startIcon: 'calendar-plus' },
            compact(d) ? 'md · 32' : 'md · 44',
          ),
          st(
            { variant: 'primary', size: 'lg', children: 'حجز موعد', startIcon: 'calendar-plus' },
            compact(d) ? 'lg · 40' : 'lg · 52',
          ),
        ],
      },
      {
        label: 'Icons',
        items: [
          st({ children: 'طباعة', startIcon: 'printer' }, 'start icon'),
          st({ children: 'التالي', endIcon: 'arrow-forward' }, 'end icon (mirrors)'),
          st({ startIcon: 'printer', 'aria-label': 'طباعة' }, 'icon only, named'),
          st(
            { variant: 'primary', children: 'حفظ', startIcon: 'check', loading: true },
            'loading: Spinner replaces the icon',
          ),
        ],
      },
    ],
  },
  {
    name: 'IconButton',
    group: 'Actions',
    desc: 'A square Button with one icon; its label names it (and shows as a tooltip when asked). md 44, sm 36.',
    play: 'Press and Tab; the tooltip opens on hover after 500 ms and at once on keyboard focus.',
    blocks: (d) => {
      const edit = { icon: 'pencil', label: 'تعديل' };
      return [
        {
          label: 'Variants',
          items: [
            st(edit, 'secondary'),
            st({ icon: 'x', label: 'إغلاق', variant: 'ghost' }, 'ghost'),
            st({ icon: 'plus', label: 'إضافة موعد', variant: 'primary' }, 'primary'),
            st({ icon: 'trash', label: 'حذف المرفق', variant: 'danger' }, 'danger'),
          ],
        },
        {
          label: 'Sizes',
          items: [
            st(edit, compact(d) ? 'md · 32' : 'md · 44'),
            st({ ...edit, size: 'sm' }, compact(d) ? 'sm · 28' : 'sm · 36'),
          ],
        },
        {
          label: 'States',
          items: [st(edit, 'rest'), ...interact(edit), st({ ...edit, disabled: true }, 'disabled')],
        },
        {
          label: 'With a tooltip',
          items: [
            st({ icon: 'printer', label: 'طباعة الوصفة', tooltip: true }, 'tooltip: hover or Tab'),
          ],
        },
      ];
    },
  },
  {
    name: 'Menu',
    group: 'Actions',
    desc: 'Actions from a button; the danger item last; a submenu opens toward the logical end. Groups of radio rows (a clinic and branch switcher) and note rows; a sheet from the bottom on a phone.',
    play: 'Press a trigger to open: arrows move, the reading-direction arrow opens a submenu, a letter jumps, Enter runs, Esc closes.',
    blocks: () => [
      {
        label: 'Triggers',
        items: [
          st(
            { triggerLabel: 'إجراءات', items: MENU_ITEMS },
            'label trigger: actions, submenu, disabled with a reason, danger',
          ),
          st(
            { triggerIcon: 'dots', 'aria-label': 'إجراءات الموعد', items: MENU_ITEMS },
            'icon trigger, named',
          ),
        ],
      },
      {
        label: 'Groups',
        items: [
          st(
            { triggerLabel: 'عيادة الياسمين', triggerIcon: 'buildings', items: MENU_GROUPS },
            'radio rows with avatar or icon, a suspended clinic, a busy branch, a note',
          ),
        ],
      },
      {
        label: 'Phone',
        items: [
          st(
            {
              triggerLabel: 'تبديل العيادة',
              presentation: 'sheet',
              title: 'تبديل العيادة',
              items: MENU_GROUPS,
            },
            'presentation: sheet (rises from the bottom)',
          ),
        ],
      },
    ],
  },
  {
    name: 'Toolbar',
    group: 'Actions',
    fill: true,
    desc: 'Light buttons in a bordered strip with one Tab stop; groups split by separators; what does not fit goes into «المزيد».',
    play: 'One Tab stop, then arrows in the reading direction; the narrow one opens «المزيد».',
    blocks: () => [
      {
        label: 'Two groups: a pressed toggle, a disabled button',
        cols: 1,
        items: [st({ 'aria-label': 'أدوات قائمة المرضى', groups: TOOL_GROUPS }, 'full width')],
      },
      {
        label: 'Narrow: the rest moves into «المزيد»',
        cols: 1,
        items: [
          st(
            { 'aria-label': 'أدوات قائمة المرضى (ضيقة)', groups: TOOL_GROUPS },
            '260 px wide',
            null,
            { w: 260 },
          ),
        ],
      },
    ],
  },
];
