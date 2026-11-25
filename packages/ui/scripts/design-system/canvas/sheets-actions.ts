// Sheets of the Foundations and Actions groups.
import { ICONS, MENU_GROUPS, MENU_ITEMS } from './data.ts';
import { compact, interact, type SheetSpec, st } from './types.ts';

const BUTTONS: [string, string, string][] = [
  ['primary', 'حفظ الزيارة', 'check'],
  ['secondary', 'طباعة', 'printer'],
  ['ghost', 'تعديل', 'pencil'],
  ['danger', 'إلغاء الموعد', 'trash'],
];

const ICON_BUTTONS: [string, string, string][] = [
  ['primary', 'plus', 'إضافة موعد'],
  ['secondary', 'pencil', 'تعديل'],
  ['ghost', 'x', 'إغلاق'],
  ['danger', 'trash', 'حذف المرفق'],
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

const LONG = 'تأكيد حجز الموعد وإرسال التذكير إلى المريض عبر واتساب';

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
        label: 'Direction: the same icons in RTL and LTR, whatever the board’s direction',
        items: [
          st({ name: 'arrow-forward', size: 'md' }, 'forward · RTL', null, { dir: 'rtl' }),
          st({ name: 'arrow-forward', size: 'md' }, 'forward · LTR', null, { dir: 'ltr' }),
          st({ name: 'caret-back', size: 'md' }, 'back · RTL', null, { dir: 'rtl' }),
          st({ name: 'caret-back', size: 'md' }, 'back · LTR', null, { dir: 'ltr' }),
          st({ name: 'clock', size: 'md' }, 'clock never mirrors · RTL', null, { dir: 'rtl' }),
          st({ name: 'clock', size: 'md' }, 'clock never mirrors · LTR', null, { dir: 'ltr' }),
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
    desc: 'Primary (one per view), secondary (the default), ghost, danger (brick, never red); sm, md, lg; an icon on the logical start. Loading keeps its label and focus and shows the Spinner of the system; a press whose request is still running shows it too.',
    play: 'Press: the playground’s button waits 1.5 s like a request and shows its busy state. Tab, Enter and Space work; hover, pressed and focus columns are fixed for display.',
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
        label: 'Icon only, named (aria-label)',
        items: BUTTONS.map(([variant, children, icon]) =>
          st({ variant, startIcon: icon, 'aria-label': children }, variant),
        ),
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
          st({ variant: 'primary', size: 'sm', children: 'حجز', loading: true }, 'sm loading'),
          st({ variant: 'primary', size: 'lg', children: 'حجز موعد', loading: true }, 'lg loading'),
          st({ size: 'sm', startIcon: 'printer', 'aria-label': 'طباعة' }, 'sm icon only'),
          st({ size: 'lg', startIcon: 'printer', 'aria-label': 'طباعة' }, 'lg icon only'),
        ],
      },
      {
        label: 'Icons and text',
        items: [
          st({ children: 'طباعة', startIcon: 'printer' }, 'start icon'),
          st({ children: 'التالي', endIcon: 'arrow-forward' }, 'end icon (mirrors)'),
          st(
            { variant: 'primary', children: 'حفظ', startIcon: 'check', loading: true },
            'loading: Spinner replaces the icon',
          ),
          st(
            { variant: 'primary', children: 'حفظ', disabled: true, loading: true },
            'disabled while loading',
          ),
          st({ variant: 'primary', children: LONG }, 'a long label', null, { w: 320 }),
          st({ children: 'Save visit', startIcon: 'check' }, 'English, LTR', null, { dir: 'ltr' }),
        ],
      },
    ],
  },
  {
    name: 'IconButton',
    group: 'Actions',
    layout: 'stack',
    desc: 'A square Button with one icon; its label names it (and shows as a tooltip when asked). md 44, sm 36; loading shows the Spinner in its place.',
    play: 'Press (the playground’s waits 1.5 s like a request) and Tab; the tooltip opens on hover after 500 ms and at once on keyboard focus.',
    blocks: (d) => [
      {
        label: 'Variants × states',
        matrix: {
          cols: ['rest', 'hover', 'pressed', 'keyboard focus', 'disabled', 'loading'],
          rows: ICON_BUTTONS.map(([variant, icon, label]) => ({
            head: variant,
            cells: [
              st({ variant, icon, label }),
              st({ variant, icon, label }, null, 'hover'),
              st({ variant, icon, label }, null, 'pressed'),
              st({ variant, icon, label }, null, 'focus'),
              st({ variant, icon, label, disabled: true }),
              st({ variant, icon, label, loading: true }),
            ],
          })),
        },
      },
      {
        label: 'Sizes',
        items: [
          st({ icon: 'pencil', label: 'تعديل' }, compact(d) ? 'md · 32' : 'md · 44'),
          st({ icon: 'pencil', label: 'تعديل', size: 'sm' }, compact(d) ? 'sm · 28' : 'sm · 36'),
          st({ icon: 'pencil', label: 'تعديل', size: 'sm', loading: true }, 'sm loading'),
        ],
      },
      {
        label: 'With a tooltip',
        items: [
          st({ icon: 'printer', label: 'طباعة الوصفة', tooltip: true }, 'tooltip: hover or Tab'),
          st(
            { icon: 'printer', label: 'طباعة الوصفة', tooltip: true },
            'keyboard focus (the tooltip opens in Play)',
            'focus',
          ),
        ],
      },
    ],
  },
  {
    name: 'Menu',
    group: 'Actions',
    desc: 'Actions from a button; the danger item last; a submenu opens toward the logical end. Groups of radio rows (a clinic and branch switcher) and note rows; a sheet from the bottom on a phone.',
    play: 'Press a trigger to open: arrows move, the reading-direction arrow opens a submenu, a letter jumps, Enter runs, Esc closes; a radio row is chosen.',
    blocks: () => [
      {
        label: 'Triggers',
        items: [
          st({ triggerLabel: 'إجراءات', items: MENU_ITEMS }, 'label'),
          st(
            { triggerIcon: 'dots', 'aria-label': 'إجراءات الموعد', items: MENU_ITEMS },
            'icon, named',
          ),
          st(
            { triggerLabel: 'إجراءات', triggerVariant: 'primary', items: MENU_ITEMS },
            'primary trigger',
          ),
          st(
            {
              triggerLabel: 'إجراءات',
              triggerVariant: 'ghost',
              triggerSize: 'sm',
              items: MENU_ITEMS,
            },
            'ghost, sm',
          ),
          st({ triggerLabel: 'إجراءات', triggerDisabled: true, items: MENU_ITEMS }, 'disabled'),
          st({ triggerLabel: 'إجراءات', items: MENU_ITEMS }, 'trigger hover', 'hover'),
          st({ triggerLabel: 'إجراءات', items: MENU_ITEMS }, 'trigger focus', 'focus'),
        ],
      },
      {
        label: 'Groups and phone',
        items: [
          st(
            { triggerLabel: 'عيادة الياسمين', triggerIcon: 'buildings', items: MENU_GROUPS },
            'clinic switcher',
          ),
          st(
            {
              triggerLabel: 'تبديل العيادة',
              presentation: 'sheet',
              title: 'تبديل العيادة',
              items: MENU_GROUPS,
            },
            'presentation: sheet',
          ),
        ],
      },
    ],
    open: [
      {
        suffix: 'OpenActions',
        label: 'مفتوحة · إجراءات',
        h: 760,
        cap: 'Open: actions, a submenu, a disabled item with its reason, the danger item last',
        p: { triggerLabel: 'إجراءات', items: MENU_ITEMS, defaultOpen: true },
      },
      {
        suffix: 'OpenGroups',
        label: 'مفتوحة · تبديل العيادة',
        h: 760,
        cap: 'Open: radio rows with an avatar or icon, a suspended clinic, a busy branch, a note',
        p: {
          triggerLabel: 'عيادة الياسمين',
          triggerIcon: 'buildings',
          items: MENU_GROUPS,
          defaultOpen: true,
        },
      },
      {
        suffix: 'OpenSheet',
        label: 'مفتوحة · من الأسفل',
        h: 760,
        cap: 'Open: the sheet of a phone, under its title, with the grab handle and close',
        p: {
          triggerLabel: 'تبديل العيادة',
          presentation: 'sheet',
          title: 'تبديل العيادة',
          items: MENU_GROUPS,
          defaultOpen: true,
        },
      },
    ],
  },
  {
    name: 'Toolbar',
    group: 'Actions',
    fill: true,
    desc: 'Light buttons in a bordered strip with one Tab stop; groups split by separators; a pressed toggle; a long label cut at 150 px with its tooltip; what does not fit goes into «المزيد».',
    play: 'One Tab stop, then arrows in the reading direction; the narrow one opens «المزيد».',
    blocks: () => [
      {
        label: 'Two groups: a pressed toggle, a disabled button',
        cols: 1,
        items: [st({ 'aria-label': 'أدوات قائمة المرضى', groups: TOOL_GROUPS }, 'full width')],
      },
      {
        label: 'States of a button (the first)',
        cols: 3,
        items: interact(
          { 'aria-label': 'أدوات قائمة المرضى', groups: [TOOL_GROUPS[0] ?? []] },
          { scope: 1 },
        ),
      },
      {
        label: 'A long label and a narrow strip',
        cols: 2,
        items: [
          st(
            {
              'aria-label': 'أدوات التصدير',
              groups: [
                [
                  { label: 'تصدير قائمة مرضى اليوم بصيغة جدول', icon: 'file-text' },
                  { label: 'طباعة', icon: 'printer' },
                ],
              ],
            },
            'cut at 150 px, the whole label in its tooltip',
          ),
          st(
            { 'aria-label': 'أدوات قائمة المرضى (ضيقة)', groups: TOOL_GROUPS },
            '260 px wide: the rest in «المزيد»',
            null,
            { w: 260 },
          ),
        ],
      },
    ],
  },
];
