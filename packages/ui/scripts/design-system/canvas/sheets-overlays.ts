// Sheets of the Overlays group; each has open views on boards beside it (a modal covers its frame).
import { ALERT, ALERT2, DIALOG, DIALOG2, DRAWER, TOASTS, TOASTS2 } from './data.ts';
import type { Density, OpenView, Props, SheetSpec, Theme } from './types.ts';
import { st } from './types.ts';

const view = (
  suffix: string,
  theme: Theme,
  density: Density,
  size: [number, number],
  p: Props,
  cap: string,
  inline = false,
): OpenView => ({
  suffix,
  theme,
  density,
  w: size[0],
  h: size[1],
  p,
  cap,
  ...(inline ? { inline } : {}),
});

const NOTE = {
  triggerLabel: 'ملاحظة سريعة',
  triggerIcon: 'pencil',
  title: 'ملاحظة للطبيب',
  text: 'يفضّل موعداً بعد الظهر.',
};
const SHOW = 'إظهار الإشعارات';

export const OVERLAYS: SheetSpec[] = [
  {
    name: 'Dialog',
    group: 'Overlays',
    desc: 'A modal decision or short form; the main action last, the safe one focused first; Esc and the close button close it.',
    play: 'Press a trigger to open; Tab stays inside; Esc closes.',
    blocks: () => [
      {
        label: 'Triggers',
        items: [st(DIALOG, 'a deletion'), st(DIALOG2, 'an ordinary confirmation')],
      },
    ],
    open: [
      view(
        'OpenLight',
        'light',
        'comfortable',
        [1100, 560],
        { ...DIALOG, defaultOpen: true },
        'Open · light · comfortable',
      ),
      view(
        'OpenDark',
        'dark',
        'compact',
        [1100, 560],
        { ...DIALOG2, defaultOpen: true },
        'Open · dark · compact',
      ),
    ],
  },
  {
    name: 'AlertDialog',
    group: 'Overlays',
    desc: 'The Dialog’s panel for a question that needs an answer: a danger or info mark before the title, «رجوع» focused first, the action last; no close button, no closing by a press outside.',
    play: 'Press a trigger; only «رجوع» or the action close it.',
    blocks: () => [
      { label: 'Triggers', items: [st(ALERT, 'danger'), st(ALERT2, 'info, primary action')] },
    ],
    open: [
      view(
        'OpenLight',
        'light',
        'comfortable',
        [1100, 560],
        { ...ALERT, defaultOpen: true },
        'Open · danger · light · comfortable',
      ),
      view(
        'OpenDark',
        'dark',
        'compact',
        [1100, 560],
        { ...ALERT2, defaultOpen: true },
        'Open · info · dark · compact',
      ),
      view(
        'OpenError',
        'light',
        'compact',
        [1100, 560],
        { ...ALERT, errorText: 'تعذّر الحذف. حاول مرة أخرى.', defaultOpen: true },
        'Open · with an error · light · compact',
      ),
    ],
  },
  {
    name: 'Drawer',
    group: 'Overlays',
    desc: 'A 400 px panel from the logical end (the left in Arabic), radius 16 on its inner edge; from the bottom on a tablet or phone with a named grabber.',
    play: 'Press a trigger; Esc or «إلغاء» closes.',
    blocks: () => [
      {
        label: 'Triggers',
        items: [
          st(
            { ...DRAWER, triggerLabel: 'من النهاية', triggerIcon: 'pencil' },
            'side end (default)',
          ),
          st({ ...DRAWER, triggerLabel: 'من البداية', side: 'start' }, 'side start'),
          st({ ...DRAWER, triggerLabel: 'من الأسفل', side: 'bottom' }, 'side bottom'),
        ],
      },
    ],
    open: [
      view(
        'OpenLight',
        'light',
        'comfortable',
        [1100, 640],
        { ...DRAWER, triggerLabel: 'تعديل', defaultOpen: true },
        'Open · end · light · comfortable',
      ),
      view(
        'OpenDark',
        'dark',
        'compact',
        [1100, 640],
        { ...DRAWER, triggerLabel: 'تعديل', side: 'start', defaultOpen: true },
        'Open · start · dark · compact',
      ),
      view(
        'OpenBottom',
        'light',
        'comfortable',
        [768, 760],
        { ...DRAWER, triggerLabel: 'تعديل', side: 'bottom', defaultOpen: true },
        'Open · bottom (tablet) · light',
      ),
    ],
  },
  {
    name: 'Popover',
    group: 'Overlays',
    desc: 'A small panel under a button, at its logical start; Esc or a press outside closes it.',
    play: 'Press the trigger to open and close.',
    blocks: () => [{ label: 'States', items: [st(NOTE, 'closed')] }],
    open: [
      view(
        'OpenLight',
        'light',
        'comfortable',
        [720, 360],
        { ...NOTE, defaultOpen: true },
        'Open · light · comfortable',
        true,
      ),
      view(
        'OpenDark',
        'dark',
        'compact',
        [720, 360],
        { ...NOTE, defaultOpen: true },
        'Open · dark · compact',
        true,
      ),
    ],
  },
  {
    name: 'Tooltip',
    group: 'Overlays',
    desc: 'A dark ink bubble above its trigger, 240 px at most; keyboard focus opens it at once, hover after 500 ms, touch never; never the only copy of what a person needs.',
    play: 'Hover a trigger or Tab to it.',
    blocks: () => [
      {
        label: 'Triggers',
        items: [
          st(
            { content: 'طباعة الوصفة', triggerIcon: 'printer' },
            'icon button named by the tooltip',
          ),
          st(
            { content: 'إرسال تذكير عبر واتساب', triggerLabel: 'إرسال تذكير' },
            'describes a text button',
          ),
          st({ content: 'الإشعارات', triggerIcon: 'bell', side: 'bottom' }, 'side bottom'),
        ],
      },
    ],
    open: [
      view(
        'OpenLight',
        'light',
        'comfortable',
        [720, 300],
        { content: 'طباعة الوصفة', triggerIcon: 'printer', defaultOpen: true },
        'Open · light · comfortable',
        true,
      ),
      view(
        'OpenDark',
        'dark',
        'compact',
        [720, 300],
        { content: 'إرسال تذكير عبر واتساب', triggerLabel: 'إرسال تذكير', defaultOpen: true },
        'Open · dark · compact',
        true,
      ),
    ],
  },
  {
    name: 'Toast',
    group: 'Overlays',
    openOnly: true,
    desc: 'A small card at the bottom, at the logical end (the bottom left in Arabic), three at most, the newest at the bottom; status toasts carry their icon; errors stay until closed.',
    play: 'The button shows the toasts again; each closes with its button.',
    blocks: () => [],
    open: [
      view(
        '',
        'light',
        'comfortable',
        [1100, 520],
        { toasts: TOASTS, triggerLabel: SHOW },
        'Light · comfortable · success, info with an action, warning',
      ),
      view(
        'Dark',
        'dark',
        'comfortable',
        [1100, 520],
        { toasts: TOASTS2, triggerLabel: SHOW },
        'Dark · comfortable · error (stays until closed), default',
      ),
      view(
        'CompactLight',
        'light',
        'compact',
        [1100, 520],
        { toasts: TOASTS2, triggerLabel: SHOW },
        'Light · compact · error, default',
      ),
      view(
        'CompactDark',
        'dark',
        'compact',
        [1100, 520],
        { toasts: TOASTS, triggerLabel: SHOW },
        'Dark · compact · success, info, warning',
      ),
    ],
  },
];
