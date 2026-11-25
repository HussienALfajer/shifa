// Sheets of the Overlays group; each shows its overlay open when Tweaks' `view` asks for it (a
// modal covers its whole board).
import { ALERT, ALERT2, DIALOG, DIALOG2, DRAWER, TOASTS, TOASTS2 } from './data.ts';
import type { OpenView, Props, SheetSpec } from './types.ts';
import { st } from './types.ts';

const view = (suffix: string, label: string, h: number, p: Props, cap: string): OpenView => ({
  suffix,
  label,
  h,
  p,
  cap,
});

const NOTE = {
  triggerLabel: 'ملاحظة سريعة',
  triggerIcon: 'pencil',
  title: 'ملاحظة للطبيب',
  text: 'يفضّل موعداً بعد الظهر.',
};
const SHOW = 'إظهار الإشعارات';
const open = { defaultOpen: true };

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
      view('OpenDelete', 'مفتوحة · حذف', 560, { ...DIALOG, ...open }, 'Open: a deletion'),
      view(
        'OpenConfirm',
        'مفتوحة · تأكيد عادي',
        560,
        { ...DIALOG2, ...open },
        'Open: an ordinary confirmation',
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
      view('OpenDanger', 'مفتوحة · خطر', 560, { ...ALERT, ...open }, 'Open: danger'),
      view(
        'OpenInfo',
        'مفتوحة · معلومة',
        560,
        { ...ALERT2, ...open },
        'Open: info, primary action',
      ),
      view(
        'OpenError',
        'مفتوحة · مع خطأ',
        560,
        { ...ALERT, errorText: 'تعذّر الحذف. حاول مرة أخرى.', ...open },
        'Open: the action failed',
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
        'OpenEnd',
        'مفتوح · من النهاية',
        640,
        { ...DRAWER, triggerLabel: 'تعديل', ...open },
        'Open: from the end',
      ),
      view(
        'OpenStart',
        'مفتوح · من البداية',
        640,
        { ...DRAWER, triggerLabel: 'تعديل', side: 'start', ...open },
        'Open: from the start',
      ),
      view(
        'OpenBottom',
        'مفتوح · من الأسفل',
        760,
        { ...DRAWER, triggerLabel: 'تعديل', side: 'bottom', ...open },
        'Open: from the bottom (tablets and phones)',
      ),
    ],
  },
  {
    name: 'Popover',
    group: 'Overlays',
    desc: 'A small panel under a button, at its logical start; Esc or a press outside closes it.',
    play: 'Press the trigger to open and close.',
    blocks: () => [{ label: 'States', items: [st(NOTE, 'closed')] }],
    open: [view('Open', 'مفتوحة', 360, { ...NOTE, ...open }, 'Open')],
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
        'OpenIcon',
        'مفتوح · زر أيقونة',
        300,
        { content: 'طباعة الوصفة', triggerIcon: 'printer', ...open },
        'Open: names an icon button',
      ),
      view(
        'OpenText',
        'مفتوح · زر نصي',
        300,
        { content: 'إرسال تذكير عبر واتساب', triggerLabel: 'إرسال تذكير', ...open },
        'Open: describes a text button',
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
        'Status',
        'نجاح ومعلومة وتحذير',
        520,
        { toasts: TOASTS, triggerLabel: SHOW },
        'Success, info with an action, warning',
      ),
      view(
        'Error',
        'خطأ وإشعار عادي',
        520,
        { toasts: TOASTS2, triggerLabel: SHOW },
        'Error (stays until closed), default',
      ),
    ],
  },
];
