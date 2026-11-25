// Sheets of the Forms group: the text, number and choice fields.
import { DOCTORS, PATIENTS } from './data.ts';
import { boxFocus, fieldFocus, type SheetSpec, st } from './types.ts';

const LONG_NAME = 'عبد الرحمن محمد خير الدين الحسيني الدمشقي';

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
          st({ label: 'اسم المريض', required: true }, 'required'),
          st({ label: 'اسم المريض', required: true, error: 'اكتب اسم المريض' }, 'required, error'),
          st(
            {
              label: 'رقم الهاتف',
              hint: 'عشر خانات تبدأ بـ 09',
              error: 'الرقم ناقص',
              defaultValue: '0944 12',
              dir: 'auto',
            },
            'hint and error',
          ),
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
          st(
            { label: 'بحث', startIcon: 'magnifying-glass', error: 'اكتب حرفين على الأقل' },
            'icon and error',
          ),
          st(
            { label: 'بحث', startIcon: 'magnifying-glass', defaultValue: 'لينا', disabled: true },
            'icon, disabled',
          ),
          st(
            { label: 'الاسم الكامل كما في البطاقة الشخصية', defaultValue: LONG_NAME },
            'long label and value',
          ),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: [
          ...fieldFocus({ label: 'اسم المريض', defaultValue: 'لينا زيدان' }),
          st(
            { label: 'اسم المريض', required: true, error: 'اكتب اسم المريض' },
            'keyboard focus on an error',
            'focus',
          ),
          st(
            { label: 'رقم الملف', defaultValue: '1042', readOnly: true },
            'keyboard focus, read-only',
            'focus',
          ),
        ],
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
          st(
            { label: 'سبب الزيارة', defaultValue: 'ألم في الضرس منذ يومين', maxLength: 22 },
            'counter at its limit',
          ),
          st(
            {
              label: 'ملاحظات للطبيب',
              defaultValue:
                'يفضّل موعداً بعد الظهر.\nيحتاج إلى مرافق عند الصعود.\nحساسية من البنسلين.\nيُرسل التذكير قبل يوم.',
            },
            'several lines: the box grows',
          ),
          st({ label: 'ملاحظات للطبيب', error: '500 حرف على الأكثر' }, 'error'),
          st(
            {
              label: 'ملاحظات للطبيب',
              error: 'الملاحظة أطول من المسموح',
              maxLength: 40,
              defaultValue: 'يفضّل موعداً بعد الظهر ويحتاج إلى مرافق.',
            },
            'error with the counter',
          ),
          st({ label: 'سبب الزيارة', required: true }, 'required'),
          st(
            { label: 'ملاحظات الاستقبال', defaultValue: 'وصل مبكراً.', readOnly: true },
            'read-only',
          ),
          st(
            { label: 'ملاحظات للطبيب', defaultValue: 'يفضّل موعداً بعد الظهر.', disabled: true },
            'disabled',
          ),
          st(
            { label: 'Notes', dir: 'auto', defaultValue: 'Allergic to penicillin.' },
            'Latin content, dir auto',
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
    desc: 'A password with a show toggle inside at the logical end (one name, aria-pressed); typed left to right.',
    play: 'Type, then press the eye to show and hide.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ label: 'كلمة المرور' }, 'empty'),
          st({ label: 'كلمة المرور', defaultValue: 'Shifa-2026' }, 'filled, hidden'),
          st({ label: 'كلمة المرور', required: true, hint: '8 أحرف على الأقل' }, 'required, hint'),
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
        items: boxFocus({ label: 'كلمة المرور', defaultValue: 'Shifa-2026' }),
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
            { label: 'عدد الجلسات', defaultValue: 1, min: 1, max: 20, hint: 'الحد الأدنى 1' },
            'at the minimum: − stops',
          ),
          st(
            { label: 'عدد الجلسات', defaultValue: 20, min: 1, max: 20, hint: 'الحد الأقصى 20' },
            'at the maximum: + stops',
          ),
          st(
            { label: 'العمر', defaultValue: 140, min: 0, max: 120, error: 'العمر بين 0 و120' },
            'error',
          ),
          st({ label: 'عدد الجلسات', defaultValue: 3, required: true }, 'required'),
          st({ label: 'عدد الجلسات', defaultValue: 1, disabled: true }, 'disabled'),
          st(
            { label: 'أجر المعاينة', defaultValue: 125000, unit: 'ل.س', steppers: false },
            'amount with unit',
          ),
          st(
            { label: 'الجرعة', defaultValue: 2.5, step: 0.5, unit: 'مل' },
            'a step of 0.5, a unit',
          ),
          st(
            { label: 'رصيد الصندوق', defaultValue: 12500000, unit: 'ل.س', steppers: false },
            'a long amount',
          ),
          st({ label: 'عدد الجلسات', defaultValue: null }, 'empty'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: [
          ...boxFocus({ label: 'عدد الجلسات', defaultValue: 3, min: 1, max: 20 }),
          st({ label: 'عدد الجلسات', defaultValue: 3, min: 1, max: 20 }, '+ hovered', 'hover', {
            scope: 2,
          }),
        ],
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
            { label: 'الطبيب', items: DOCTORS, placeholder: 'اختر الطبيب', required: true },
            'required',
          ),
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
          st(
            {
              label: 'الخدمة',
              items: [{ value: 'x', label: 'تنظيف الأسنان وإزالة الجير مع التلميع الكامل' }],
              defaultValue: 'x',
            },
            'a long choice, cut',
            null,
            { w: 280 },
          ),
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
    desc: 'Search a long list as you type; a word of the name starts with the text; the typed part in bold; an empty message when nothing matches.',
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
            st({ ...b, label: 'المريض المحوَّل', defaultValue: '1061' }, 'chosen: a clear button'),
            st({ ...b, label: 'المريض', hint: 'اكتب حرفين من الاسم' }, 'hint'),
            st({ ...b, label: 'المرافق', error: 'اختر مريضاً مسجلاً' }, 'error'),
            st({ ...b, label: 'صاحب الملف', disabled: true }, 'disabled'),
          ],
        },
        {
          label: 'Interaction',
          cols: 2,
          items: boxFocus({ ...b, label: 'المريض', defaultValue: '1061' }),
        },
      ];
    },
  },
  {
    name: 'DatePicker',
    group: 'Forms',
    fill: true,
    desc: 'dd/mm/yyyy, Gregorian, the week from Saturday, Levantine month names; typed or chosen from the calendar; the age under a birth date.',
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
          st({ label: 'تاريخ الميلاد', defaultValue: '1990-04-12', showAge: true }, 'with the age'),
          st({ label: 'تاريخ الموعد', required: true }, 'required'),
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
        items: boxFocus({ label: 'تاريخ الموعد', defaultValue: '2026-11-24' }),
      },
    ],
  },
  {
    name: 'TimeInput',
    group: 'Forms',
    fill: true,
    desc: 'Hour and minute, left to right, "HH:mm"; 24-hour by default, a ص/م segment on the 12-hour clock (a clinic setting).',
    play: 'Type digits or use Up and Down in each segment; the list button shows the slots.',
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
            { label: 'وقت الموعد', required: true, min: '09:00', max: '17:00' },
            'required, limits',
          ),
          st(
            { label: 'وقت الموعد', defaultValue: '19:15', error: 'اختر وقتاً بين 09:00 و17:00' },
            'error',
          ),
          st({ label: 'وقت الوصول', defaultValue: '10:05', readOnly: true }, 'read-only'),
          st({ label: 'وقت الموعد', defaultValue: '14:30', disabled: true }, 'disabled'),
        ],
      },
      {
        label: 'Interaction',
        cols: 2,
        items: boxFocus({ label: 'وقت الموعد', defaultValue: '14:30' }),
      },
    ],
  },
];
