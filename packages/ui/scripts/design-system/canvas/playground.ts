// The playground at the top of each sheet: one live copy of the real component whose main props
// are chosen in the canvas's Tweaks panel (ADR-0048). Props a component reads only when it mounts
// (`defaultValue`, `defaultChecked`) are never tweaks: the bundle's island re-renders with new
// props but does not remount, so they would not follow. `base` holds the props that stay fixed.
import {
  type Control,
  field,
  flag,
  NONE,
  type Playground,
  pick,
  SOME_ICONS,
  text,
  tweakKey,
  VARIANTS,
} from './controls.ts';
import { DOCTORS, FORM_REG, ICONS, MENU_ITEMS, PATIENTS, SETUP, WA } from './data.ts';
import { MORE_PLAYGROUNDS } from './playground-more.ts';

export { type Control, type Playground, tweakKey };

const VISIT = [
  { value: 'exam', label: 'كشف' },
  { value: 'review', label: 'مراجعة' },
  { value: 'emergency', label: 'إسعاف' },
];

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
      flag('disabled'),
      flag('loading'),
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
      flag('tooltip'),
    ],
  },
  Menu: {
    base: { items: MENU_ITEMS, title: 'إجراءات الموعد' },
    controls: [
      text('triggerLabel', 'إجراءات'),
      pick('triggerIcon', [NONE, 'dots', 'gear']),
      pick('presentation', ['popover', 'sheet']),
    ],
  },
  Toolbar: {
    base: {
      groups: [
        [
          { label: 'طباعة', icon: 'printer' },
          { label: 'تصدير', icon: 'file-text' },
        ],
        [
          { label: 'الأحدث أولاً', pressed: true },
          { label: 'الأعمدة', icon: 'list' },
        ],
      ],
    },
    controls: [text('aria-label', 'أدوات قائمة المرضى')],
  },
  Input: {
    base: {},
    controls: [
      ...field('اسم المريض'),
      text('placeholder', 'مثال: لينا زيدان'),
      pick('type', ['text', 'email', 'tel', 'search', 'url']),
      pick('startIcon', SOME_ICONS),
      flag('required'),
      flag('readOnly'),
      flag('disabled'),
    ],
  },
  Textarea: {
    base: {},
    controls: [
      ...field('ملاحظات للطبيب', 'تظهر للطبيب فقط'),
      text('placeholder', 'اكتب ملاحظة'),
      flag('required'),
      flag('disabled'),
    ],
  },
  PasswordInput: {
    base: {},
    controls: [...field('كلمة المرور'), flag('required'), flag('disabled')],
  },
  NumberInput: {
    base: { defaultValue: 3, min: 1, max: 20 },
    controls: [...field('عدد الجلسات'), text('unit', ''), flag('steppers', true), flag('disabled')],
  },
  Select: {
    base: { items: DOCTORS },
    controls: [...field('الطبيب'), text('placeholder', 'اختر الطبيب'), flag('disabled')],
  },
  Combobox: {
    base: { items: PATIENTS },
    controls: [
      ...field('المريض'),
      text('placeholder', 'ابحث بالاسم'),
      text('emptyMessage', 'لا يوجد مريض بهذا الاسم'),
      flag('disabled'),
    ],
  },
  DatePicker: {
    base: {},
    controls: [...field('تاريخ الموعد', 'يمكن الكتابة مباشرة'), flag('disabled')],
  },
  TimeInput: {
    base: {},
    controls: [
      ...field('وقت الموعد', 'دوام العيادة 09:00 – 17:00'),
      pick('hourCycle', [
        { value: 24, label: '24 ساعة' },
        { value: 12, label: '12 ساعة (ص/م)' },
      ]),
      flag('required'),
      flag('disabled'),
    ],
  },
  OtpInput: {
    base: {},
    controls: [...field('رمز التحقق'), pick('length', [6, 4]), flag('disabled')],
  },
  Checkbox: {
    base: {},
    controls: [
      text('children', 'مريض جديد'),
      text('description', ''),
      text('error', ''),
      flag('disabled'),
    ],
  },
  RadioGroup: {
    base: { items: VISIT },
    controls: [
      ...field('نوع الزيارة'),
      pick('orientation', ['vertical', 'horizontal']),
      flag('required'),
      flag('disabled'),
    ],
  },
  Switch: {
    base: {},
    controls: [text('children', 'تذكير عبر واتساب'), text('description', ''), flag('disabled')],
  },
  Field: {
    base: { dir: 'auto' },
    controls: [
      ...field('رقم الهاتف', 'يصله تأكيد الموعد عبر واتساب'),
      text('placeholder', '09xx xxx xxx'),
      flag('required'),
      flag('disabled'),
    ],
  },
  Form: {
    base: { fields: FORM_REG.fields, cancelLabel: 'إلغاء' },
    controls: [
      text('title', 'تسجيل مريض جديد'),
      text('summary', 'حقلان يحتاجان إلى تصحيح.'),
      text('submitLabel', 'سجّل'),
      flag('submitting'),
    ],
  },
  CopyField: {
    base: { value: SETUP, share: { href: WA, label: 'إرسال عبر واتساب' } },
    controls: [
      text('label', 'رابط الإعداد'),
      text('expiry', 'ينتهي بعد 72 ساعة · يعمل مرة واحدة'),
      flag('multiline'),
      flag('iconOnly'),
      flag('disabled'),
    ],
  },
  ...MORE_PLAYGROUNDS,
};
