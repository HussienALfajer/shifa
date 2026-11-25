// The playground at the top of each sheet: one live copy of the real component and a panel of its
// main props at its right (dock.ts), whose first values are the canvas's Tweaks (ADR-0048).
// A prop the component reads only when it mounts (`defaultValue`, `defaultChecked`) is a `once`
// control: a change mounts the copy afresh (the bundle's `instanceKey`). `base` holds the props
// that stay fixed; `handlers` make the copy behave as in the app; `scenarios` set several props.
import {
  choose,
  field,
  flag,
  NONE,
  once,
  type Playground,
  pick,
  SOME_ICONS,
  text,
  VARIANTS,
  WAIT,
} from './controls.ts';
import { DOCTORS, FORM_REG, ICONS, MENU_GROUPS, MENU_ITEMS, PATIENTS, SETUP, WA } from './data.ts';
import { FORM_CLEAN } from './playground-data.ts';
import { MORE_PLAYGROUNDS } from './playground-more.ts';

export { type Control, type Option, type Playground, tweakKey } from './controls.ts';

const VISIT = [
  { value: 'exam', label: 'كشف' },
  { value: 'review', label: 'مراجعة' },
  { value: 'emergency', label: 'إسعاف', description: 'يُقدَّم على الدور' },
  { value: 'online', label: 'استشارة عن بعد', disabled: true },
];
const LONG = 'تأكيد حجز الموعد وإرسال التذكير إلى المريض عبر واتساب';

export const PLAYGROUNDS: Record<string, Playground> = {
  Icon: {
    base: {},
    controls: [pick('name', ICONS, 'stethoscope'), pick('size', ['md', 'sm']), text('label', '')],
  },
  Button: {
    base: {},
    controls: [
      text('children', 'حفظ الزيارة'),
      pick('variant', VARIANTS, 'primary'),
      pick('size', ['md', 'sm', 'lg']),
      pick('startIcon', SOME_ICONS),
      pick('endIcon', [NONE, 'arrow-forward', 'caret-down']),
      text('aria-label', ''),
      flag('disabled'),
      flag('loading'),
    ],
    // A press runs a request of 1.5 s: the real Button stays busy while its onClick's Promise runs.
    handlers: { onClick: WAIT() },
    scenarios: [
      { label: 'Save', set: { variant: 'primary', label: 'حفظ الزيارة', startIcon: 'check' } },
      { label: 'Busy', set: { variant: 'primary', label: 'حفظ الزيارة', loading: true } },
      { label: 'Disabled', set: { variant: 'secondary', label: 'طباعة', disabled: true } },
      {
        label: 'Icon only',
        set: { label: '', startIcon: 'printer', 'aria-label': 'طباعة', variant: 'secondary' },
      },
      { label: 'Next', set: { label: 'التالي', endIcon: 'arrow-forward', startIcon: '' } },
      { label: 'Long label', set: { label: LONG, variant: 'primary' } },
    ],
  },
  IconButton: {
    base: {},
    controls: [
      pick('icon', ICONS, 'pencil'),
      text('label', 'تعديل'),
      pick('variant', VARIANTS, 'secondary'),
      pick('size', ['md', 'sm']),
      flag('disabled'),
      flag('loading'),
      flag('tooltip'),
    ],
    handlers: { onClick: WAIT() },
    scenarios: [
      { label: 'Close', set: { icon: 'x', label: 'إغلاق', variant: 'ghost' } },
      { label: 'Add', set: { icon: 'plus', label: 'إضافة موعد', variant: 'primary' } },
      { label: 'Delete', set: { icon: 'trash', label: 'حذف المرفق', variant: 'danger' } },
      { label: 'With tooltip', set: { icon: 'printer', label: 'طباعة الوصفة', tooltip: true } },
    ],
  },
  Menu: {
    base: { title: 'إجراءات الموعد' },
    controls: [
      choose(
        'items',
        { actions: MENU_ITEMS, groups: MENU_GROUPS },
        {
          actions: 'actions',
          groups: 'clinic switcher',
        },
      ),
      text('triggerLabel', 'إجراءات'),
      pick('triggerIcon', [NONE, 'dots', 'gear', 'buildings']),
      pick('triggerVariant', VARIANTS, 'secondary'),
      pick('triggerSize', ['md', 'sm']),
      pick('presentation', ['popover', 'sheet']),
      flag('triggerDisabled'),
      once(flag('defaultOpen')),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true } },
      { label: 'Icon trigger', set: { triggerLabel: '', triggerIcon: 'dots' } },
      {
        label: 'Clinic switcher',
        set: { items: 'groups', triggerLabel: 'عيادة الياسمين', triggerIcon: 'buildings' },
      },
      { label: 'Phone sheet', set: { presentation: 'sheet', defaultOpen: true } },
    ],
  },
  Toolbar: {
    base: { 'aria-label': 'أدوات قائمة المرضى' },
    controls: [
      choose(
        'groups',
        {
          two: [
            [
              { label: 'طباعة', icon: 'printer' },
              { label: 'تصدير', icon: 'file-text' },
            ],
            [
              { label: 'الأحدث أولاً', pressed: true },
              { label: 'دمج', disabled: true },
              { label: 'الأعمدة', icon: 'list' },
            ],
          ],
          one: [
            [
              { label: 'طباعة', icon: 'printer' },
              { label: 'الأحدث أولاً', pressed: false },
            ],
          ],
          long: [
            [
              { label: 'تصدير قائمة مرضى اليوم بصيغة جدول', icon: 'file-text' },
              { label: 'طباعة', icon: 'printer' },
            ],
          ],
        },
        { two: 'two groups', one: 'one group', long: 'a long label' },
      ),
    ],
  },
  Input: {
    base: {},
    controls: [
      ...field('اسم المريض'),
      text('placeholder', 'مثال: لينا زيدان'),
      pick('type', ['text', 'email', 'tel', 'search', 'url']),
      pick('dir', [NONE, 'auto', 'ltr']),
      pick('startIcon', SOME_ICONS),
      flag('required'),
      flag('readOnly'),
      flag('disabled'),
      once(text('defaultValue', '')),
    ],
    scenarios: [
      { label: 'Error', set: { required: true, error: 'اكتب اسم المريض' } },
      { label: 'Filled', set: { defaultValue: 'لينا زيدان' } },
      {
        label: 'Email (Latin)',
        set: {
          label: 'البريد',
          type: 'email',
          dir: 'auto',
          defaultValue: 'sara.ahmad@example.com',
        },
      },
      { label: 'Search', set: { label: 'بحث', type: 'search', startIcon: 'magnifying-glass' } },
      { label: 'Read-only', set: { label: 'رقم الملف', defaultValue: '1042', readOnly: true } },
    ],
  },
  Textarea: {
    base: {},
    controls: [
      ...field('ملاحظات للطبيب', 'تظهر للطبيب فقط'),
      text('placeholder', 'اكتب ملاحظة'),
      pick('maxLength', [NONE, 200, 500]),
      flag('required'),
      flag('readOnly'),
      flag('disabled'),
      once(text('defaultValue', '')),
    ],
    scenarios: [
      { label: 'Counter', set: { maxLength: 200, defaultValue: 'يفضّل موعداً بعد الظهر.' } },
      { label: 'Error', set: { error: '500 حرف على الأكثر' } },
      { label: 'Read-only', set: { readOnly: true, defaultValue: 'يفضّل موعداً بعد الظهر.' } },
    ],
  },
  PasswordInput: {
    base: {},
    controls: [
      ...field('كلمة المرور'),
      pick('autoComplete', ['current-password', 'new-password']),
      flag('required'),
      flag('disabled'),
      once(text('defaultValue', '')),
    ],
    scenarios: [
      { label: 'Filled', set: { defaultValue: 'Shifa-2026' } },
      {
        label: 'Too short',
        set: { defaultValue: 'Shif', error: '8 أحرف على الأقل', autoComplete: 'new-password' },
      },
    ],
  },
  NumberInput: {
    base: { min: 1, max: 20 },
    controls: [
      ...field('عدد الجلسات'),
      text('unit', ''),
      pick('step', [1, 5]),
      flag('steppers', true),
      flag('required'),
      flag('disabled'),
      once(pick('defaultValue', [3, 1, 20])),
    ],
    scenarios: [
      { label: 'At the minimum', set: { defaultValue: 1 } },
      { label: 'At the maximum', set: { defaultValue: 20, hint: 'الحد الأقصى 20' } },
      { label: 'Amount', set: { label: 'أجر المعاينة', unit: 'ل.س', steppers: false } },
    ],
  },
  Select: {
    base: { items: DOCTORS },
    controls: [
      ...field('الطبيب'),
      text('placeholder', 'اختر الطبيب'),
      flag('required'),
      flag('disabled'),
      once(
        pick('defaultValue', [NONE, ...DOCTORS.map((d) => ({ value: d.value, label: d.label }))]),
      ),
    ],
    scenarios: [
      { label: 'Chosen', set: { defaultValue: DOCTORS[0]?.value ?? '' } },
      { label: 'Error', set: { error: 'اختر الطبيب قبل الحفظ' } },
    ],
  },
  Combobox: {
    base: { items: PATIENTS },
    controls: [
      ...field('المريض'),
      text('placeholder', 'ابحث بالاسم'),
      text('emptyMessage', 'لا يوجد مريض بهذا الاسم'),
      flag('disabled'),
      once(
        pick('defaultValue', [
          NONE,
          ...PATIENTS.slice(0, 3).map((x) => ({ value: x.value, label: x.label })),
        ]),
      ),
    ],
    scenarios: [
      { label: 'Chosen', set: { defaultValue: PATIENTS[0]?.value ?? '' } },
      { label: 'Error', set: { error: 'اختر مريضاً مسجلاً' } },
    ],
  },
  DatePicker: {
    base: {},
    controls: [
      ...field('تاريخ الموعد', 'يمكن الكتابة مباشرة'),
      flag('showAge'),
      flag('required'),
      flag('disabled'),
      once(pick('defaultValue', [NONE, '2026-11-24', '1990-04-12'])),
    ],
    scenarios: [
      {
        label: 'Birth date, age',
        set: { label: 'تاريخ الميلاد', showAge: true, defaultValue: '1990-04-12' },
      },
      { label: 'Error', set: { error: 'اختر تاريخاً من اليوم فصاعداً', defaultValue: '2026-11-24' } },
    ],
  },
  TimeInput: {
    base: { min: '09:00', max: '17:00' },
    controls: [
      ...field('وقت الموعد', 'دوام العيادة 09:00 – 17:00'),
      pick('hourCycle', [
        { value: 24, label: '24 ساعة' },
        { value: 12, label: '12 ساعة (ص/م)' },
      ]),
      flag('required'),
      flag('readOnly'),
      flag('disabled'),
      once(pick('defaultValue', [NONE, '10:30', '14:30'])),
    ],
    scenarios: [
      { label: '12-hour', set: { hourCycle: 12, defaultValue: '14:30' } },
      { label: 'Error', set: { error: 'اختر وقتاً بين 09:00 و17:00', defaultValue: '14:30' } },
    ],
  },
  OtpInput: {
    base: {},
    controls: [
      ...field('رمز التحقق'),
      pick('length', [6, 4]),
      flag('required'),
      flag('disabled'),
      once(pick('defaultValue', [NONE, '4820', '482071'])),
    ],
    scenarios: [
      { label: 'Partly typed', set: { defaultValue: '4820' } },
      {
        label: 'Wrong code',
        set: { defaultValue: '482071', error: 'الرمز غير صحيح. بقيت محاولتان' },
      },
    ],
  },
  Checkbox: {
    base: {},
    controls: [
      text('children', 'مريض جديد'),
      text('description', ''),
      text('error', ''),
      flag('disabled'),
      once(choose('defaultChecked', { off: false, on: true, some: 'indeterminate' })),
    ],
    scenarios: [
      { label: 'Checked', set: { defaultChecked: 'on' } },
      { label: 'Some', set: { defaultChecked: 'some', label: 'كل المواعيد' } },
      { label: 'Error', set: { error: 'وافق على الشروط للمتابعة', label: 'أوافق على الشروط' } },
    ],
  },
  RadioGroup: {
    base: { items: VISIT },
    controls: [
      ...field('نوع الزيارة'),
      pick('orientation', ['vertical', 'horizontal']),
      flag('required'),
      flag('disabled'),
      once(pick('defaultValue', [NONE, 'exam', 'review'])),
    ],
    scenarios: [
      { label: 'Chosen', set: { defaultValue: 'exam' } },
      { label: 'Error', set: { required: true, error: 'اختر نوع الزيارة' } },
    ],
  },
  Switch: {
    base: {},
    controls: [
      text('children', 'تذكير عبر واتساب'),
      text('description', ''),
      flag('disabled'),
      once(flag('defaultChecked')),
    ],
    scenarios: [
      { label: 'On', set: { defaultChecked: true } },
      {
        label: 'With a description',
        set: { label: 'قبول الحجز من صفحة العيادة', description: 'يظهر للمرضى زر «احجز»' },
      },
    ],
  },
  Field: {
    base: {},
    controls: [
      ...field('رقم الهاتف', 'يصله تأكيد الموعد عبر واتساب'),
      text('placeholder', '09xx xxx xxx'),
      pick('dir', ['auto', 'ltr', 'rtl']),
      flag('required'),
      flag('disabled'),
    ],
    scenarios: [{ label: 'Error', set: { error: 'اكتب رقماً من عشر خانات', required: true } }],
  },
  Form: {
    base: { cancelLabel: 'إلغاء' },
    controls: [
      choose(
        'fields',
        { errors: FORM_REG.fields, clean: FORM_CLEAN },
        { errors: 'after a failed submit', clean: 'before a submit' },
      ),
      text('title', 'تسجيل مريض جديد'),
      text('summary', 'حقلان يحتاجان إلى تصحيح.'),
      text('submitLabel', 'سجّل'),
      text('cancelLabel', 'إلغاء'),
      flag('submitting'),
    ],
    scenarios: [{ label: 'Before a submit', set: { fields: 'clean', summary: '' } }],
  },
  CopyField: {
    base: {},
    controls: [
      choose('value', { link: SETUP, loading: undefined }, { link: 'a link', loading: 'loading' }),
      text('label', 'رابط الإعداد'),
      text('expiry', 'ينتهي بعد 72 ساعة · يعمل مرة واحدة'),
      choose(
        'share',
        { whatsapp: { href: WA, label: 'إرسال عبر واتساب' }, none: undefined },
        { whatsapp: 'WhatsApp', none: 'none' },
      ),
      flag('multiline'),
      flag('iconOnly'),
      flag('disabled'),
    ],
  },
  ...MORE_PLAYGROUNDS,
};
