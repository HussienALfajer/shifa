// Admin web's home and «إنشاء عيادة» (A-01-10 checkpoint 3): every state of
// src/admin/clinics-page.tsx in its frame (admin-frame.tsx) and of create-clinic-page.tsx, with
// the owner's link shown once after a clinic is created.
import { summary } from '../../routes-platform.ts';
import type { Scenario, Sheet, Step, World } from '../../scenario.ts';
import { fail, ok } from '../../server.ts';
import { ACTIVE_OWNER, CLINIC_NAMES, FREE_OWNER, PENDING_OWNER } from '../../world-admin.ts';
import { local } from '../../world.ts';

const list = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/', ...s });
const search = (value: string): Step => ({ fillIn: 'input[type="search"]', value });

export const clinicsSheet: Sheet = {
  id: 'Clinics',
  title: 'العيادات',
  route: '/',
  note: 'Admin web’s home in its frame (the logo, «إدارة شفاء», the avatar; «العيادات» and «خروج»): every clinic newest first with type, status, end date («ينتهي خلال 5 أيام»), owner and «لم يُكمل الإعداد»; loading, no clinic yet, a failed read; the search (a match, none), the status filter with its counts (one with no clinic), the hidden creation date in «الأعمدة».',
  code: [
    'admin/clinics-page.tsx',
    'admin/admin-frame.tsx',
    'admin/button-link.tsx',
    'account/load-failed.tsx',
  ],
  scenarios: [
    list({ id: 'List', title: 'كل العيادات' }),
    list({
      id: 'Loading',
      title: 'تحميل العيادات',
      answers: { 'GET /platform/clinics': 'hold' },
    }),
    list({
      id: 'Empty',
      title: 'لا عيادات بعد',
      world: (w) => {
        w.platform = [];
      },
    }),
    list({
      id: 'Offline',
      title: 'تعذّر التحميل: لا اتصال',
      answers: { 'GET /platform/clinics': 'offline' },
    }),
    list({
      id: 'ServerError',
      title: 'تعذّر التحميل: خطأ في الخادم',
      answers: { 'GET /platform/clinics': fail(500, 'internal_error') },
    }),
    list({
      id: 'Retrying',
      title: 'إعادة المحاولة بعد تعذّر التحميل',
      answers: { 'GET /platform/clinics': ['offline', 'hold'] },
      steps: [{ press: 'retry' }],
    }),
    list({
      id: 'Search',
      title: 'بحث يطابق عيادة',
      steps: [search(CLINIC_NAMES.active.split(' ')[1] ?? ''), { wait: 900 }],
    }),
    list({
      id: 'NoMatch',
      title: 'بحث لا يطابق شيئًا',
      steps: [search('الزهراء للعلاج الطبيعي'), { until: 'clinicsNoMatchTitle' }],
    }),
    list({
      id: 'SearchOffline',
      title: 'بحث دون اتصال',
      answers: {
        'GET /platform/clinics': (r, w) => (r.query.has('search') ? 'offline' : listOf(w)),
      },
      steps: [search(CLINIC_NAMES.trial.split(' ')[1] ?? ''), { wait: 1200 }],
    }),
    list({
      id: 'FilterTrial',
      title: 'تصفية: التجريبية',
      steps: [{ press: 'clinicsFilterTrial', values: { count: 3 } }],
    }),
    list({
      id: 'FilterNone',
      title: 'تصفية: حالة بلا عيادات',
      world: (w) => {
        w.platform = w.platform.filter((p) => p.clinic.status !== 'suspended');
      },
      steps: [
        { press: 'clinicsFilterSuspended', values: { count: 0 } },
        { until: 'clinicsNoneInStatus' },
      ],
    }),
    list({
      id: 'Columns',
      title: 'قائمة «الأعمدة»: تاريخ الإنشاء',
      overlay: true,
      steps: [{ pressText: 'الأعمدة' }],
    }),
  ],
};

/** The list answer of the world (GET /platform/clinics without a search). */
const listOf = (w: World) => ok({ clinics: w.platform.map((p) => summary(p.clinic)) });

const create = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/clinics/new', ...s });

/** The form as the super admin fills it: the clinic, then its owner with this phone. */
const filled = (phone: string, owner = FREE_OWNER.full): Step[] => [
  { fill: 'fieldClinicName', value: CLINIC_NAMES.newClinic },
  { check: 'متعددة الأطباء' },
  { fill: 'fieldOwnerName', value: owner },
  { fill: 'fieldOwnerPhone', value: phone },
];
const submit: Step = { press: 'createSubmit' };
const FREE = local(FREE_OWNER.phone);
const created: Step[] = [...filled(FREE), submit, { until: 'createdTitle' }];

export const createClinicSheet: Sheet = {
  id: 'CreateClinic',
  title: 'إنشاء عيادة',
  route: '/clinics/new',
  note: 'Creating a clinic and its owner: the empty form, every field missing, «موقوفة» with its warning, a filled form, sending; the server’s refusals (a phone it cannot read, a phone whose other clinic is not set up), no network and a server error; then the clinic created with the owner’s link shown once (a setup link, or an invitation for a phone with an account), and the question before leaving it uncopied.',
  code: ['admin/create-clinic-page.tsx', 'admin/data.ts', 'admin/phone.ts'],
  scenarios: [
    create({ id: 'Empty', title: 'نموذج فارغ' }),
    create({ id: 'Missing', title: 'حقول ناقصة عند الإرسال', steps: [submit] }),
    create({ id: 'Suspended', title: 'اختيار «موقوفة»: تحذير', steps: [{ check: 'موقوفة' }] }),
    create({ id: 'Filled', title: 'نموذج مكتمل', steps: filled(FREE) }),
    create({
      id: 'Sending',
      title: 'جارٍ الإنشاء',
      answers: { 'POST /platform/clinics': 'hold' },
      steps: [...filled(FREE), submit],
    }),
    create({
      id: 'PhoneInvalid',
      title: 'رفض الخادم: رقم غير صحيح',
      steps: [...filled('0912'), submit, { until: 'phoneInvalid' }],
    }),
    create({
      id: 'Pending',
      title: 'للرقم عيادة أخرى لم يُكمل مالكها الإعداد',
      steps: [
        ...filled(local(PENDING_OWNER.phone), PENDING_OWNER.full),
        submit,
        { until: 'createPendingTitle' },
      ],
    }),
    create({
      id: 'Offline',
      title: 'لا اتصال: لا نعرف إن أُنشئت',
      answers: { 'POST /platform/clinics': ['offline'] },
      steps: [...filled(FREE), submit, { until: 'unreachableTitle' }],
    }),
    create({
      id: 'ServerError',
      title: 'خطأ في الخادم',
      answers: { 'POST /platform/clinics': [fail(500, 'internal_error')] },
      steps: [...filled(FREE), submit, { until: 'actionFailedTitle' }],
    }),
    create({ id: 'Created', title: 'أُنشئت: رابط الإعداد مرة واحدة', steps: created }),
    create({
      id: 'CreatedInvitation',
      title: 'أُنشئت لرقم له حساب: رابط دعوة',
      steps: [
        ...filled(local(ACTIVE_OWNER.phone), ACTIVE_OWNER.full),
        submit,
        { until: 'linkInvitation' },
      ],
    }),
    create({
      id: 'LeaveAsk',
      title: 'المغادرة قبل نسخ الرابط: سؤال',
      overlay: true,
      steps: [...created, { press: 'navClinics' }, { until: 'linkLeaveTitle' }],
    }),
    create({
      id: 'OpenClinicAsk',
      title: '«فتح صفحة العيادة» قبل النسخ: سؤال',
      overlay: true,
      steps: [...created, { press: 'linkOpenClinic' }, { until: 'linkLeaveTitle' }],
    }),
    create({
      id: 'OpenClinic',
      title: 'غادر دون نسخ: صفحة العيادة الجديدة',
      steps: [
        ...created,
        { press: 'linkOpenClinic' },
        { press: 'linkLeaveGo' },
        { until: 'clinicSubTitle' },
      ],
    }),
  ],
};
