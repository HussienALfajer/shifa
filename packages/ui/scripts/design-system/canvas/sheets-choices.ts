// Sheets of the Forms group: choices, the field frame, a whole form, the copy field.
import { FORM_REG, FORM_SIGNIN, SETUP, WA } from './data.ts';
import { interact, type SheetSpec, st } from './types.ts';

const VISIT = [
  { value: 'exam', label: 'كشف' },
  { value: 'review', label: 'مراجعة' },
  { value: 'emergency', label: 'إسعاف' },
  { value: 'home', label: 'زيارة منزلية (غير متاحة)', disabled: true },
];

export const CHOICES: SheetSpec[] = [
  {
    name: 'Checkbox',
    group: 'Forms',
    desc: 'A 20 px mark at the logical start, the whole line a 44 px target; for a choice sent with a form.',
    play: 'Press or Space toggles.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ children: 'مريض جديد' }, 'unchecked'),
          st({ children: 'مريض جديد', defaultChecked: true }, 'checked'),
          st({ children: 'تحديد الكل', defaultChecked: 'indeterminate' }, 'some'),
          st({ children: 'أوافق على شروط الحجز', error: 'الموافقة مطلوبة للحجز' }, 'error'),
          st({ children: 'مريض جديد', defaultChecked: true, disabled: true }, 'disabled'),
          st(
            {
              children: 'مريض لديه حساسية دوائية',
              defaultChecked: true,
              description: 'تظهر علامة تحذير في ملفه',
            },
            'with a description',
          ),
        ],
      },
      { label: 'Interaction', cols: 3, items: interact({ children: 'مريض جديد' }) },
    ],
  },
  {
    name: 'RadioGroup',
    group: 'Forms',
    fill: true,
    desc: 'One of a few choices, vertical or (short ones) horizontal; a disabled option stays in the list.',
    play: 'Arrows move and choose; Tab leaves the group.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            { label: 'نوع الزيارة', items: VISIT, defaultValue: 'exam' },
            'vertical, a disabled option',
          ),
          st(
            {
              label: 'نوع الزيارة',
              items: VISIT.slice(0, 3),
              error: 'اختر نوع الزيارة',
              required: true,
            },
            'required, error',
          ),
          st(
            {
              label: 'الجنس',
              orientation: 'horizontal',
              defaultValue: 'female',
              items: [
                { value: 'female', label: 'أنثى' },
                { value: 'male', label: 'ذكر' },
              ],
            },
            'horizontal',
          ),
          st(
            { label: 'نوع الزيارة', items: VISIT.slice(0, 3), defaultValue: null },
            'nothing chosen',
          ),
        ],
      },
    ],
  },
  {
    name: 'Switch',
    group: 'Forms',
    desc: 'A 44 × 24 track at the logical start for a setting that acts at once.',
    play: 'Press or Space switches.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ children: 'تذكير عبر واتساب' }, 'off'),
          st({ children: 'تذكير عبر واتساب', defaultChecked: true }, 'on'),
          st({ children: 'تذكير بالبريد', disabled: true }, 'disabled'),
          st(
            {
              children: 'قبول الحجز من صفحة العيادة',
              defaultChecked: true,
              description: 'يظهر للمرضى زر «احجز»',
            },
            'with a description',
          ),
        ],
      },
      { label: 'Interaction', cols: 3, items: interact({ children: 'تذكير عبر واتساب' }) },
    ],
  },
  {
    name: 'Field',
    group: 'Forms',
    fill: true,
    desc: 'Label, required asterisk, hint and error around a control.',
    play: 'Type in each field.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            {
              label: 'رقم الهاتف',
              required: true,
              dir: 'auto',
              placeholder: '09xx xxx xxx',
              hint: 'يصله تأكيد الموعد عبر واتساب',
            },
            'required, hint',
          ),
          st(
            {
              label: 'رقم الهاتف',
              required: true,
              dir: 'auto',
              defaultValue: '0944 12',
              hint: 'يصله تأكيد الموعد عبر واتساب',
              error: 'رقم الهاتف ناقص: 10 أرقام تبدأ بـ 09',
            },
            'hint and error',
          ),
          st(
            { label: 'البريد', dir: 'auto', defaultValue: 'sara.ahmad@example.com' },
            'Latin content',
          ),
          st({ label: 'اسم المريض', defaultValue: 'لينا زيدان', disabled: true }, 'disabled'),
        ],
      },
    ],
  },
  {
    name: 'Form',
    group: 'Forms',
    fill: true,
    layout: 'stack',
    desc: 'A whole form in one state: a summary of what needs fixing, fields in a grid, the main action first. In code React Hook Form with the server’s Zod schema.',
    play: 'Fields work; the buttons do not send anything here.',
    blocks: () => [
      {
        label: 'After a failed submit · while submitting',
        cols: 2,
        items: [
          st(FORM_REG, 'registration with two errors'),
          st(FORM_SIGNIN, 'sign-in, submitting'),
        ],
      },
    ],
  },
  {
    name: 'CopyField',
    group: 'Forms',
    fill: true,
    desc: 'A value shown once to copy or send: read-only, left to right in the mono font, «نسخ» inside the box at the logical end, an optional WhatsApp link and an expiry line.',
    play: 'Press «نسخ»: it says «نُسخ»; if the clipboard refuses, the value is selected to copy by hand.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st(
            {
              value: SETUP,
              label: 'رابط الإعداد',
              share: { href: WA, label: 'إرسال عبر واتساب' },
              expiry: 'ينتهي بعد 72 ساعة · يعمل مرة واحدة',
            },
            'ready, share, expiry',
            null,
            { w: 560 },
          ),
          st({ label: 'رابط الإعداد' }, 'loading', null, { w: 560 }),
          st(
            {
              value: SETUP,
              label: 'رابط الإعداد',
              expiry: 'استُبدل هذا الرابط برابط جديد',
              disabled: true,
            },
            'replaced (disabled)',
            null,
            { w: 560 },
          ),
          st(
            {
              value: SETUP,
              label: 'رابط الإعداد',
              multiline: true,
              iconOnly: true,
              expiry: 'ينتهي بعد 72 ساعة',
            },
            'phone: wraps, icon-only copy',
            null,
            { w: 340 },
          ),
        ],
      },
    ],
  },
];
