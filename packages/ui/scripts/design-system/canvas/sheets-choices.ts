// Sheets of the Forms group: choices, the field frame, a whole form, the copy field.
import { FORM_REG, FORM_SIGNIN, SETUP, WA } from './data.ts';
import { FORM_CLEAN } from './playground-data.ts';
import { fieldFocus, type SheetSpec, st } from './types.ts';

const VISIT = [
  { value: 'exam', label: 'كشف' },
  { value: 'review', label: 'مراجعة', description: 'خلال أسبوعين من الكشف' },
  { value: 'emergency', label: 'إسعاف', description: 'يُقدَّم على الدور' },
  { value: 'home', label: 'زيارة منزلية (غير متاحة)', disabled: true },
];
const LONG = 'أوافق على حفظ بياناتي الصحية في ملف العيادة واستخدامها لتذكيري بالمواعيد القادمة';

/** Checkbox and Switch have no pressed look of their own: hover and keyboard focus only. */
const marks = (p: Record<string, unknown>, what: string) => [
  st(p, `hover, ${what}`, 'hover'),
  st(p, `keyboard focus, ${what}`, 'focus'),
];

export const CHOICES: SheetSpec[] = [
  {
    name: 'OtpInput',
    group: 'Forms',
    desc: 'Six slots, left to right in both directions; one field for screen readers; Western digits. The active slot and its caret follow real focus, so they show in Play.',
    play: 'Press a slot and type or paste six digits; Backspace moves back.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st({ label: 'رمز التحقق', hint: 'أرسلناه برسالة إلى 09xx xxx 973' }, 'empty, hint'),
          st({ label: 'رمز التحقق', defaultValue: '4820' }, 'partly typed'),
          st({ label: 'رمز التحقق', defaultValue: '482071' }, 'filled'),
          st({ label: 'رمز التحقق', required: true }, 'required'),
          st(
            { label: 'رمز التحقق', defaultValue: '482075', error: 'الرمز غير صحيح. بقيت محاولتان' },
            'error',
          ),
          st({ label: 'رمز التحقق', defaultValue: '482071', disabled: true }, 'disabled'),
          st({ label: 'رمز الدخول', length: 4, defaultValue: '73' }, 'four slots'),
        ],
      },
    ],
  },
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
          st({ children: 'أوافق على شروط الحجز', required: true }, 'required'),
          st({ children: 'أوافق على شروط الحجز', error: 'الموافقة مطلوبة للحجز' }, 'error'),
          st(
            {
              children: 'أوافق على شروط الحجز',
              defaultChecked: true,
              error: 'الموافقة مطلوبة للحجز',
            },
            'error, checked',
          ),
          st({ children: 'مريض جديد', disabled: true }, 'disabled'),
          st({ children: 'مريض جديد', defaultChecked: true, disabled: true }, 'disabled, checked'),
          st(
            {
              children: 'مريض لديه حساسية دوائية',
              defaultChecked: true,
              description: 'تظهر علامة تحذير في ملفه',
            },
            'with a description',
          ),
          st({ children: LONG }, 'a long label wraps'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: [
          ...marks({ children: 'مريض جديد' }, 'unchecked'),
          ...marks({ children: 'مريض جديد', defaultChecked: true }, 'checked'),
        ],
      },
    ],
  },
  {
    name: 'RadioGroup',
    group: 'Forms',
    fill: true,
    desc: 'One of a few choices, vertical or (short ones) horizontal; an option may carry a description; a disabled option stays in the list.',
    play: 'Arrows move and choose; Tab leaves the group.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            { label: 'نوع الزيارة', items: VISIT, defaultValue: 'exam', hint: 'يحدد مدة الموعد' },
            'vertical, descriptions, a disabled option, hint',
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
          st(
            {
              label: 'نوع الزيارة',
              items: VISIT.slice(0, 3),
              defaultValue: 'review',
              disabled: true,
            },
            'the whole group disabled',
          ),
        ],
      },
      {
        label: 'Interaction (one option)',
        cols: 2,
        items: [
          st(
            { label: 'نوع الزيارة', items: VISIT.slice(0, 3), defaultValue: 'exam' },
            'hover on the second',
            'hover',
            { scope: { role: 'radiogroup', nth: 2 } },
          ),
          st(
            { label: 'نوع الزيارة', items: VISIT.slice(0, 3), defaultValue: 'exam' },
            'keyboard focus on the chosen',
            'focus',
            { scope: { role: 'radiogroup', nth: 1 } },
          ),
        ],
      },
    ],
  },
  {
    name: 'Switch',
    group: 'Forms',
    desc: 'A 44 × 24 track at the logical start for a setting that acts at once; on, the thumb carries a tick.',
    play: 'Press or Space switches.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ children: 'تذكير عبر واتساب' }, 'off'),
          st({ children: 'تذكير عبر واتساب', defaultChecked: true }, 'on'),
          st({ children: 'تذكير بالبريد', disabled: true }, 'disabled, off'),
          st({ children: 'تذكير بالبريد', defaultChecked: true, disabled: true }, 'disabled, on'),
          st(
            {
              children: 'قبول الحجز من صفحة العيادة',
              defaultChecked: true,
              description: 'يظهر للمرضى زر «احجز»',
            },
            'with a description',
          ),
          st({ children: LONG }, 'a long label wraps'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: [
          ...marks({ children: 'تذكير عبر واتساب' }, 'off'),
          ...marks({ children: 'تذكير عبر واتساب', defaultChecked: true }, 'on'),
        ],
      },
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
          st({ label: 'رقم الملف', defaultValue: '1042', readOnly: true }, 'read-only'),
          st({ label: 'اسم المريض', defaultValue: 'لينا زيدان', disabled: true }, 'disabled'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: fieldFocus({ label: 'اسم المريض', defaultValue: 'لينا زيدان' }),
      },
    ],
  },
  {
    name: 'Form',
    group: 'Forms',
    fill: true,
    layout: 'stack',
    desc: 'A whole form in one state: a summary of what needs fixing, fields in a grid, the main action last. In code React Hook Form with the server’s Zod schema.',
    play: 'Fields work; pressing the main action runs a 1.5 s request (the button is busy), nothing is sent.',
    blocks: () => [
      {
        label: 'Before a submit · after a failed submit',
        cols: 2,
        items: [
          st(
            {
              ...FORM_REG,
              summary: undefined,
              fields: FORM_CLEAN,
            },
            'registration, before a submit',
          ),
          st(FORM_REG, 'registration with two errors'),
        ],
      },
      {
        label: 'While submitting',
        cols: 2,
        items: [st(FORM_SIGNIN, 'sign-in, submitting')],
      },
    ],
  },
  {
    name: 'CopyField',
    group: 'Forms',
    fill: true,
    desc: 'A value shown once to copy or send: read-only, left to right in the mono font, «نسخ» inside the box at the logical end, an optional WhatsApp link and an expiry line.',
    play: 'Press «نسخ»: it says «نُسخ»; if the clipboard refuses (it may on the canvas), the value is selected to copy by hand.',
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
          st({ value: SETUP, label: 'رابط الإعداد' }, 'copy only', null, { w: 560 }),
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
          st(
            {
              value: 'https://clinic.shifa.example/s/AB12',
              label: 'Setup link',
              copyLabel: 'Copy',
              copiedLabel: 'Copied',
            },
            'English',
            null,
            { w: 420, dir: 'ltr' },
          ),
        ],
      },
      {
        label: 'Interaction',
        items: fieldFocus({ value: SETUP, label: 'رابط الإعداد' }, { w: 560, scope: 'outer' }),
      },
    ],
  },
];
