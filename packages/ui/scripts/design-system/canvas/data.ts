// Synthetic data of the "Shifa Components" sheets, taken from the design system's own previews
// (`scripts/design-system/components/*/preview.html`) where they have it. Never a real person.

export const ICONS = [
  'archive',
  'arrow-back',
  'arrow-forward',
  'bell',
  'buildings',
  'calendar',
  'calendar-plus',
  'caret-back',
  'caret-down',
  'caret-forward',
  'caret-up',
  'check',
  'check-circle',
  'clock',
  'cloud-check',
  'copy',
  'dots',
  'eye',
  'eye-slash',
  'file-text',
  'gear',
  'house',
  'info',
  'list',
  'magnifying-glass',
  'minus',
  'pencil',
  'phone',
  'plus',
  'printer',
  'share',
  'sign-out',
  'trash',
  'user',
  'users',
  'warning',
  'wifi-slash',
  'x',
  'x-circle',
  'blood-drop',
  'heart-organ',
  'medicines',
  'stethoscope',
  'syringe',
  'tooth',
];

export const DOCTORS = [
  { value: '1001', label: 'د. سعاد الحمصي' },
  { value: '1002', label: 'د. حسين طرابيشي' },
  { value: '1003', label: 'د. مريم المصري' },
  { value: '1004', label: 'د. نادية الحلبي', disabled: true, hint: 'في إجازة' },
];

export const PATIENTS = [
  { value: '1061', label: 'عبد الكريم الحسين', description: 'ملف 1061' },
  { value: '1063', label: 'عبد الكريم العلي', description: 'ملف 1063' },
  { value: '1065', label: 'عبد الكريم العمر', description: 'ملف 1065' },
  { value: '1000', label: 'روان الجاسم', description: 'ملف 1000' },
  { value: '1001', label: 'بلال عطار', description: 'ملف 1001' },
  { value: '1002', label: 'خديجة النجار', description: 'ملف 1002' },
];

export const MENU_ITEMS = [
  { value: 'edit', label: 'تعديل الموعد', icon: 'pencil' },
  { value: 'copy', label: 'نسخ رابط الحجز' },
  {
    label: 'طباعة',
    icon: 'printer',
    items: [
      { value: 'small', label: 'إيصال صغير' },
      { value: 'page', label: 'ورقة كاملة' },
    ],
  },
  { separator: true },
  { value: 'move', label: 'نقل إلى طبيب آخر', disabled: true, hint: 'لا طبيب متاح' },
  { separator: true },
  { value: 'cancel', label: 'إلغاء الموعد', icon: 'trash', danger: true },
];

export const MENU_GROUPS = [
  {
    group: 'العيادة',
    value: 'c1',
    radios: [
      {
        value: 'c1',
        label: 'عيادة الياسمين',
        avatar: 'عيادة الياسمين',
        description: 'طبيبة · آخر نشاط اليوم',
      },
      {
        value: 'c2',
        label: 'مركز النور الطبي',
        avatar: 'مركز النور الطبي',
        description: 'استقبال · آخر نشاط أمس',
      },
      {
        value: 'c3',
        label: 'عيادة الشهباء',
        avatar: 'عيادة الشهباء',
        description: 'العيادة موقوفة مؤقتاً',
        badge: 'موقوفة',
        disabled: true,
      },
    ],
  },
  {
    group: 'الفرع',
    value: 'b1',
    radios: [
      { value: 'b1', label: 'فرع حلب الجديدة', icon: 'buildings' },
      { value: 'b2', label: 'فرع أعزاز', icon: 'buildings', busy: true },
    ],
  },
  {
    group: 'دعوات',
    notes: [
      { label: 'دعوة من مركز الرحمة', icon: 'bell', description: 'تُقبل من رابطها في الرسالة' },
    ],
  },
];

export const CODES = [
  'k7m2q-9xw4r',
  'h8zdt-3npwa',
  'p5rte-9cqeb',
  'b2nvk-7yfgm',
  'x6gjh-4tsmq',
  'c9wat-3hune',
  'r4yxe-6bnqz',
  'f7mck-2vjta',
  'u3ksy-5wgad',
  'd8qpm-4rzhe',
];
export const SETUP = 'https://clinic.shifa.example/setup#t=Qm9ndXMtc3ludGhldGljLXRva2VuLTAwMDE';
export const WA = `https://wa.me/?text=${encodeURIComponent(SETUP)}`;
export const OTP_URI =
  'otpauth://totp/Shifa:%2B963930012345?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Shifa';

export const TABLE = {
  columns: [
    { id: 'name', header: 'الاسم', sortable: true },
    { id: 'file', header: 'رقم الملف', kind: 'latin' },
    { id: 'visit', header: 'آخر زيارة', sortable: true },
    { id: 'balance', header: 'الرصيد (ل.س)', kind: 'number', sortable: true },
  ],
  rows: [
    { name: 'مريضة تجريبية', file: 'P-10482', visit: '22/11/2026', balance: 0 },
    { name: 'مريض الاختبار', file: 'P-10517', visit: '22/11/2026', balance: 45000 },
    { name: 'مريضة نموذج', file: 'P-09876', visit: '21/11/2026', balance: 0 },
    { name: 'مريض عيّنة', file: 'P-10231', visit: '20/11/2026', balance: 120000 },
    { name: 'مريضة مثال', file: 'P-10602', visit: '18/11/2026', balance: 0 },
  ],
};

export const PALETTE = {
  triggerLabel: 'بحث',
  title: 'بحث وأوامر',
  inputLabel: 'ابحث عن مريض أو إجراء',
  emptyText: 'لا نتائج لـ «{query}»',
  groups: [
    {
      label: 'المرضى',
      items: [
        { value: 'p1', label: 'أحمد توران', description: 'ملف 1187', icon: 'user' },
        { value: 'p2', label: 'لينا الأسعد', description: 'ملف 1042', icon: 'user' },
        { value: 'p3', label: 'لينا يونس', description: 'ملف 0412', icon: 'user' },
      ],
    },
    {
      label: 'إجراءات',
      items: [
        { value: 'a1', label: 'موعد جديد', icon: 'calendar-plus' },
        { value: 'a2', label: 'تسجيل مريض جديد', icon: 'plus' },
      ],
    },
  ],
};

export const DIALOG = {
  triggerLabel: 'إلغاء الموعد',
  triggerVariant: 'danger',
  triggerIcon: 'trash',
  title: 'إلغاء الموعد؟',
  description: 'موعد الثلاثاء 24/11/2026 الساعة 10:30. سيصل المريضَ إشعار بالإلغاء.',
  cancelLabel: 'رجوع',
  confirmLabel: 'تأكيد الإلغاء',
  confirmVariant: 'danger',
};
export const DIALOG2 = {
  triggerLabel: 'تأجيل الموعد',
  triggerIcon: 'clock',
  title: 'تأجيل الموعد إلى الخميس؟',
  description: 'الخميس 26/11/2026 الساعة 11:00. يصل المريضَ إشعار بالموعد الجديد.',
  cancelLabel: 'رجوع',
  confirmLabel: 'تأجيل',
  confirmVariant: 'primary',
};
export const ALERT = {
  triggerLabel: 'حذف الوصفة',
  triggerIcon: 'trash',
  title: 'حذف وصفة المريض؟',
  description: 'وصفة 12/11/2026، ثلاثة أدوية. لا يمكن التراجع عن الحذف.',
  cancelLabel: 'رجوع',
  actionLabel: 'حذف الوصفة',
};
export const ALERT2 = {
  triggerLabel: 'إنهاء الزيارة',
  tone: 'info',
  actionVariant: 'primary',
  title: 'إنهاء زيارة المريض؟',
  description: 'تُرسل الفاتورة إلى الاستقبال ويُستدعى المريض التالي.',
  cancelLabel: 'رجوع',
  actionLabel: 'إنهاء الزيارة',
};
export const DRAWER = {
  title: 'تعديل الموعد',
  description: 'الثلاثاء 24/11/2026 الساعة 10:30',
  fields: [
    { label: 'الهاتف', value: '0930 024 973' },
    { label: 'ملاحظة', value: 'يفضّل موعداً بعد الظهر' },
  ],
  cancelLabel: 'إلغاء',
  saveLabel: 'حفظ',
};
export const TOASTS = [
  { type: 'success', title: 'حُفظت الوصفة', description: 'ثلاثة أدوية' },
  { type: 'info', title: 'نُقل الموعد إلى الخميس 26/11', actionLabel: 'تراجع' },
  { type: 'warning', title: 'لم يُرسل التذكير بعد', description: 'سيُعاد الإرسال عند عودة الاتصال' },
];
export const TOASTS2 = [
  {
    type: 'error',
    title: 'تعذّر حفظ الفاتورة',
    description: 'انقطع الاتصال. يبقى الإشعار حتى تغلقه.',
  },
  { type: 'default', title: 'نُسخ رابط الحجز' },
];

export const FORM_REG = {
  title: 'تسجيل مريض جديد',
  summary: 'حقلان يحتاجان إلى تصحيح.',
  fields: [
    {
      kind: 'input',
      label: 'الاسم الكامل',
      required: true,
      defaultValue: 'لينا زيدان',
      half: true,
    },
    {
      kind: 'input',
      label: 'رقم الهاتف',
      required: true,
      dir: 'auto',
      defaultValue: '0944 12',
      error: '10 أرقام تبدأ بـ 09',
      half: true,
    },
    {
      kind: 'radio',
      label: 'الجنس',
      orientation: 'horizontal',
      defaultValue: 'female',
      items: [
        { value: 'female', label: 'أنثى' },
        { value: 'male', label: 'ذكر' },
      ],
      half: true,
    },
    { kind: 'time', label: 'الوقت المفضّل للمواعيد', defaultValue: '16:00', half: true },
    {
      kind: 'textarea',
      label: 'ملاحظات',
      defaultValue: 'حساسية من البنسلين.',
      hint: 'تظهر للطبيب فقط',
    },
    { kind: 'switch', label: 'تذكير بالمواعيد عبر واتساب', defaultChecked: true },
    {
      kind: 'checkbox',
      label: 'أوافق على حفظ بياناتي في ملف العيادة',
      error: 'الموافقة مطلوبة للتسجيل',
    },
  ],
  cancelLabel: 'إلغاء',
  submitLabel: 'سجّل',
};
export const FORM_SIGNIN = {
  title: 'الدخول',
  fields: [
    { kind: 'input', label: 'رقم الهاتف', dir: 'auto', defaultValue: '0930 024 973' },
    { kind: 'password', label: 'كلمة المرور', defaultValue: 'Shifa-2026' },
    { kind: 'otp', label: 'رمز التحقق', defaultValue: '4820' },
  ],
  submitLabel: 'ادخل',
  submitting: true,
};
