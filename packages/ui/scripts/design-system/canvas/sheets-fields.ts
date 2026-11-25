// Sheets of the Forms group: the text, number and choice fields.
import { DOCTORS, PATIENTS } from './data.ts';
import { fieldFocus, type SheetSpec, st } from './types.ts';

export const FIELDS: SheetSpec[] = [
  {
    name: 'Input',
    group: 'Forms',
    fill: true,
    desc: 'The shared field box: label, hint and error around it; an error is a 2 px danger border with an icon and text; dir auto for Latin content.',
    play: 'Type, select, Tab between fields.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'اسم المريض', placeholder: 'مثال: لينا زيدان' }, 'empty, placeholder'),
          st({ label: 'اسم المريض', defaultValue: 'لينا زيدان' }, 'filled'),
          st({ label: 'اسم المريض', required: true, error: 'اكتب اسم المريض' }, 'required, error'),
          st({ label: 'اسم المريض', defaultValue: 'لينا زيدان', disabled: true }, 'disabled'),
          st({ label: 'رقم الملف', defaultValue: '1042', readOnly: true }, 'read-only'),
          st(
            { label: 'البريد', type: 'email', dir: 'auto', defaultValue: 'sara.ahmad@example.com' },
            'Latin content, dir auto',
          ),
          st(
            {
              label: 'بحث',
              type: 'search',
              startIcon: 'magnifying-glass',
              placeholder: 'اسم أو رقم هاتف',
              hint: 'يكفي جزء من الاسم',
            },
            'search icon, hint',
          ),
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
    name: 'Textarea',
    group: 'Forms',
    fill: true,
    desc: 'Longer text that grows with it; maxLength shows a «n / max» counter.',
    play: 'Type: the box grows and the counter follows.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'ملاحظات للطبيب', placeholder: 'اكتب ملاحظة' }, 'empty'),
          st(
            {
              label: 'ملاحظات للطبيب',
              defaultValue: 'يفضّل موعداً بعد الظهر، ويحتاج إلى مرافق.',
              maxLength: 500,
              hint: 'تظهر للطبيب فقط',
            },
            'filled, counter, hint',
          ),
          st({ label: 'ملاحظات للطبيب', error: '500 حرف على الأكثر' }, 'error'),
          st(
            { label: 'ملاحظات للطبيب', defaultValue: 'يفضّل موعداً بعد الظهر.', disabled: true },
            'disabled',
          ),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: fieldFocus({ label: 'ملاحظات للطبيب', defaultValue: 'يفضّل موعداً بعد الظهر.' }),
      },
    ],
  },
  {
    name: 'PasswordInput',
    group: 'Forms',
    fill: true,
    desc: 'A password with a show toggle inside at the logical end (one name, aria-pressed).',
    play: 'Type, then press the eye to show and hide.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'كلمة المرور' }, 'empty'),
          st({ label: 'كلمة المرور', defaultValue: 'Shifa-2026' }, 'filled, hidden'),
          st(
            {
              label: 'كلمة المرور الجديدة',
              autoComplete: 'new-password',
              defaultValue: 'Shif',
              error: '8 أحرف على الأقل',
            },
            'error',
          ),
          st({ label: 'كلمة المرور', disabled: true }, 'disabled'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: fieldFocus({ label: 'كلمة المرور', defaultValue: 'Shifa-2026' }),
      },
    ],
  },
  {
    name: 'NumberInput',
    group: 'Forms',
    fill: true,
    desc: '− at the logical start, + at the end; Western digits with comma grouping; an amount takes a unit and no steppers.',
    play: 'Press − and +, or Up and Down; the buttons stop at the limits.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'عدد الجلسات', defaultValue: 3, min: 1, max: 20 }, 'steppers'),
          st(
            { label: 'عدد الجلسات', defaultValue: 20, min: 1, max: 20, hint: 'الحد الأقصى 20' },
            'at the maximum',
          ),
          st(
            { label: 'العمر', defaultValue: 140, min: 0, max: 120, error: 'العمر بين 0 و120' },
            'error',
          ),
          st({ label: 'عدد الجلسات', defaultValue: 1, disabled: true }, 'disabled'),
          st(
            { label: 'أجر المعاينة', defaultValue: 125000, unit: 'ل.س', steppers: false },
            'amount with unit',
          ),
          st({ label: 'عدد الجلسات', defaultValue: null }, 'empty'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: fieldFocus({ label: 'عدد الجلسات', defaultValue: 3, min: 1, max: 20 }),
      },
    ],
  },
  {
    name: 'Select',
    group: 'Forms',
    fill: true,
    desc: 'One of a short list; the chosen option has a check; typing finds a name without «د.»; a disabled option says why.',
    play: 'Press a field to open the list; arrows, typing «م», Enter and Esc work.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'الطبيب', items: DOCTORS, placeholder: 'اختر الطبيب' }, 'empty, placeholder'),
          st({ label: 'الطبيب المعالج', items: DOCTORS, defaultValue: '1001' }, 'chosen'),
          st(
            {
              label: 'الطبيب',
              items: DOCTORS,
              placeholder: 'اختر الطبيب',
              error: 'اختر الطبيب قبل الحفظ',
            },
            'error',
          ),
          st({ label: 'الطبيب', items: DOCTORS, defaultValue: '1002', disabled: true }, 'disabled'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: fieldFocus({ label: 'الطبيب', items: DOCTORS, placeholder: 'اختر الطبيب' }),
      },
    ],
  },
  {
    name: 'Combobox',
    group: 'Forms',
    fill: true,
    desc: 'Search a long list as you type; a word of the name starts with the text; an empty message when nothing matches.',
    play: 'Type «عب» to see three suggestions, or «زز» for the empty message.',
    blocks: () => {
      const b = {
        items: PATIENTS,
        emptyMessage: 'لا يوجد مريض بهذا الاسم',
        placeholder: 'ابحث بالاسم',
      };
      return [
        {
          label: 'States',
          cols: 2,
          items: [
            st({ ...b, label: 'المريض' }, 'empty'),
            st({ ...b, label: 'المريض المحوَّل', defaultValue: '1061' }, 'chosen'),
            st({ ...b, label: 'المرافق', error: 'اختر مريضاً مسجلاً' }, 'error'),
            st({ ...b, label: 'صاحب الملف', disabled: true }, 'disabled'),
          ],
        },
        { label: 'Interaction', cols: 2, items: fieldFocus({ ...b, label: 'المريض' }) },
      ];
    },
  },
  {
    name: 'DatePicker',
    group: 'Forms',
    fill: true,
    desc: 'dd/mm/yyyy, Gregorian, the week from Saturday, Levantine month names; typed or chosen from the calendar.',
    play: 'Type the date, or press the calendar button and move with the arrows.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            { label: 'تاريخ الميلاد', defaultValue: null, hint: 'يمكن الكتابة مباشرة' },
            'empty, hint',
          ),
          st({ label: 'تاريخ الموعد', defaultValue: '2026-11-24', min: '2026-11-20' }, 'chosen'),
          st(
            {
              label: 'تاريخ المتابعة',
              defaultValue: '2026-11-12',
              error: 'اختر تاريخاً من اليوم فصاعداً',
            },
            'error',
          ),
          st({ label: 'تاريخ التسجيل', defaultValue: '2025-02-03', disabled: true }, 'disabled'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: [st({ label: 'تاريخ الموعد', defaultValue: '2026-11-24' }, 'hover', 'hover')],
      },
    ],
  },
  {
    name: 'TimeInput',
    group: 'Forms',
    fill: true,
    desc: 'Hour and minute, left to right, "HH:mm"; 24-hour by default, a ص/م segment on the 12-hour clock (a clinic setting).',
    play: 'Type digits or use Up and Down in each segment.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'وقت الموعد' }, 'empty'),
          st(
            { label: 'وقت الموعد', defaultValue: '14:30', hint: 'دوام العيادة 09:00 – 17:00' },
            '24-hour, hint',
          ),
          st({ label: 'وقت الموعد', defaultValue: '14:30', hourCycle: 12 }, '12-hour'),
          st(
            { label: 'وقت الموعد', defaultValue: '19:15', error: 'اختر وقتاً بين 09:00 و17:00' },
            'error',
          ),
          st({ label: 'وقت الموعد', defaultValue: '14:30', disabled: true }, 'disabled'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: [st({ label: 'وقت الموعد', defaultValue: '14:30' }, 'hover', 'hover')],
      },
    ],
  },
  {
    name: 'OtpInput',
    group: 'Forms',
    desc: 'Six slots, left to right in both directions; one field for screen readers; Western digits.',
    play: 'Type or paste six digits; Backspace moves back.',
    blocks: () => [
      {
        label: 'States',
        items: [
          st({ label: 'رمز التحقق', hint: 'أرسلناه برسالة إلى 0930 024 973' }, 'empty, hint'),
          st({ label: 'رمز التحقق', defaultValue: '4820' }, 'partly typed'),
          st({ label: 'رمز التحقق', defaultValue: '482071' }, 'filled'),
          st(
            { label: 'رمز التحقق', defaultValue: '482075', error: 'الرمز غير صحيح. بقيت محاولتان' },
            'error',
          ),
          st({ label: 'رمز التحقق', defaultValue: '482071', disabled: true }, 'disabled'),
        ],
      },
      { label: 'Interaction', items: fieldFocus({ label: 'رمز التحقق', defaultValue: '4820' }) },
    ],
  },
];
