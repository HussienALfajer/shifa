// The team's states after acting (A-01-08, A-01-12): the drawer's reads failing, each account
// action asked, done and refused, the member's form saved and refused, adding a member refused,
// and the phone fix refused. The sheet is in team.ts.
import type { Answer, Scenario, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { B_MAIN, B_OLD, B_SECOND, DOCTOR, FREE_PHONE, LEFT, local, RECEPTION } from '../world.ts';
import { add, addFilled, fixPhone, NAME, open, team } from './team-steps.ts';

const DIALOG = '[role="alertdialog"]';
const drawer = (s: Omit<Scenario, 'path' | 'overlay'>): Scenario => team({ overlay: true, ...s });
const deactivateAsk: Step[] = [...open(DOCTOR.name), { press: 'memberDeactivate' }];
const deactivate: Step[] = [...deactivateAsk, { press: 'memberDeactivate', within: DIALOG }];
const resetMfa: Step[] = [
  ...open(DOCTOR.name),
  { press: 'memberResetMfa' },
  { press: 'memberResetMfaAction', within: DIALOG },
];
const reactivateAsk: Step[] = [...open(LEFT.name), { press: 'memberReactivate' }];
const reactivate: Step[] = [...reactivateAsk, { press: 'memberReactivate', within: DIALOG }];
const passwordLinkAsk: Step[] = [...open(DOCTOR.name), { press: 'memberPasswordLink' }];
const passwordLink: Step[] = [...passwordLinkAsk, { press: 'memberLinkAction', within: DIALOG }];
const editRoles: Step[] = [...open(DOCTOR.name), { click: '[data-testid="role-assistant"] label' }];
// A role and its branch, so the form is valid and the save reaches the server.
const saveRoles: Step[] = [
  ...editRoles,
  { check: B_MAIN.name, within: '[data-testid="role-assistant"]' },
  { press: 'save' },
];
const submit: Step[] = [...addFilled, { press: 'addSubmit' }];
const fixTo = (phone: string): Step[] => [
  ...fixPhone,
  { fill: 'memberFixPhoneField', value: phone },
  { press: 'memberFixPhoneAction' },
];
const FREE = local(FREE_PHONE);

const refusal = (id: string, title: string, route: string, answer: Answer, steps: Step[]) =>
  drawer({ id, title, answers: { [route]: answer }, steps });

export const teamReads: Scenario[] = [
  refusal('MemberLoadFailed', 'تعذّر تحميل العضو', 'GET /team/members/:id', 'offline', [
    { pressText: DOCTOR.name },
    { until: 'loadFailedTitle' },
  ]),
  refusal('MemberGone', 'العضو لم يعد في الفريق', 'GET /team/members/:id', fail(404, 'not_found'), [
    { pressText: DOCTOR.name },
  ]),
  refusal('ChoicesFailed', 'تعذّر تحميل الصلاحيات', 'GET /team/permissions', 'offline', [
    { pressText: DOCTOR.name },
    { until: 'loadFailedTitle' },
  ]),
  refusal('AddChoicesFailed', 'إضافة: تعذّر تحميل الصلاحيات', 'GET /team/permissions', 'offline', [
    { press: 'teamAdd' },
    { until: 'loadFailedTitle' },
  ]),
  team({
    id: 'NoneInStatus',
    title: 'فرع بلا موقوفين',
    path: `/team?branch=${B_SECOND.id}`,
    steps: [{ press: 'teamFilterDeactivated', values: { count: 0 } }],
  }),
  drawer({
    id: 'ArchivedRole',
    title: 'درج عضو له دور في فرع مؤرشف',
    world: (w: World) => {
      const doctor = w.members.find((m) => m.id === DOCTOR.id);
      doctor?.roles.push({ role: 'doctor', branchId: B_OLD.id, branchName: B_OLD.name });
    },
    steps: open(DOCTOR.name),
  }),
];

export const teamActions: Scenario[] = [
  drawer({
    id: 'CancelInviteAsk',
    title: 'سؤال قبل إلغاء الدعوة',
    steps: [...open(RECEPTION.name), { press: 'memberCancelInvite' }],
  }),
  drawer({ id: 'ReactivateAsk', title: 'سؤال قبل إعادة التفعيل', steps: reactivateAsk }),
  drawer({ id: 'PasswordLinkAsk', title: 'سؤال قبل رابط كلمة مرور جديدة', steps: passwordLinkAsk }),
  drawer({ id: 'DeactivateDone', title: 'أُوقف الحساب', steps: deactivate }),
  drawer({ id: 'ReactivateDone', title: 'أُعيد تفعيل الحساب', steps: reactivate }),
  drawer({ id: 'ResetMfaDone', title: 'أُعيد ضبط التحقق بخطوتين', steps: resetMfa }),
  drawer({ id: 'PasswordLinkIssued', title: 'رابط كلمة مرور جديدة', steps: passwordLink }),
  refusal(
    'ActionOffline',
    'إيقاف: لا اتصال',
    'POST /team/members/:id/deactivate',
    ['offline'],
    deactivate,
  ),
  refusal(
    'ActionLastOwner',
    'إيقاف مرفوض: المالك الأخير',
    'POST /team/members/:id/deactivate',
    [fail(409, 'last_owner')],
    deactivate,
  ),
  refusal(
    'ActionServerError',
    'إيقاف: خطأ في الخادم',
    'POST /team/members/:id/deactivate',
    [fail(500, 'internal_error')],
    deactivate,
  ),
  refusal(
    'ActionGone',
    'إيقاف: العضو لم يعد في الفريق',
    'POST /team/members/:id/deactivate',
    [fail(404, 'not_found')],
    deactivate,
  ),
  refusal(
    'AlreadyDeactivated',
    'إيقاف: أُوقف من مكان آخر',
    'POST /team/members/:id/deactivate',
    [fail(409, 'member_deactivated')],
    deactivate,
  ),
  refusal(
    'NotDeactivated',
    'إعادة التفعيل: أُعيد من مكان آخر',
    'POST /team/members/:id/reactivate',
    [fail(409, 'member_not_deactivated')],
    reactivate,
  ),
  refusal(
    'AccountShared',
    'رابط كلمة المرور: الحساب مشترك بعيادة أخرى',
    'POST /team/members/:id/setup-link',
    [fail(409, 'account_shared')],
    passwordLink,
  ),
  refusal(
    'MfaGone',
    'إعادة ضبط التحقق: لم يعد مربوطًا',
    'POST /team/members/:id/reset-mfa',
    [fail(409, 'mfa_not_enrolled')],
    resetMfa,
  ),
  refusal(
    'SelfAction',
    'إجراء على الحساب نفسه: مرفوض',
    'POST /team/members/:id/deactivate',
    [fail(409, 'self_action')],
    deactivate,
  ),
];

const saveRefused = (id: string, title: string, answer: Answer) =>
  refusal(id, title, 'PATCH /team/members/:id', answer, saveRoles);

export const teamSaves: Scenario[] = [
  drawer({ id: 'Saved', title: 'حُفظ التعديل', steps: saveRoles }),
  drawer({
    id: 'Saving',
    title: 'جارٍ الحفظ',
    answers: { 'PATCH /team/members/:id': 'hold' },
    steps: saveRoles,
  }),
  drawer({
    id: 'RemoveAllAsk',
    title: 'سؤال قبل إزالة كل الأدوار',
    steps: [
      ...open(DOCTOR.name),
      { click: '[data-testid="role-doctor"] label' },
      { press: 'save' },
    ],
  }),
  drawer({
    id: 'NameMissing',
    title: 'الاسم فارغ عند الحفظ',
    steps: [...open(DOCTOR.name), { fill: 'memberName', value: '' }, { press: 'save' }],
  }),
  saveRefused('SaveOffline', 'الحفظ: لا اتصال', ['offline']),
  saveRefused('SaveLastOwner', 'الحفظ مرفوض: المالك الأخير', [fail(409, 'last_owner')]),
  saveRefused('SaveOwnerProtected', 'الحفظ مرفوض: دور المالك محمي', [
    fail(409, 'owner_role_protected'),
  ]),
  saveRefused('SaveBranchArchived', 'الحفظ مرفوض: الفرع أُرشف', [fail(409, 'branch_archived')]),
  saveRefused('SaveServerError', 'الحفظ: خطأ في الخادم', [fail(500, 'internal_error')]),
  saveRefused('SaveGone', 'الحفظ: العضو لم يعد في الفريق', [fail(404, 'not_found')]),
];

const fixRefused = (id: string, title: string, answer: Answer) =>
  refusal(id, title, 'PATCH /team/members/:id/phone', answer, fixTo(FREE));

export const teamAdds: Scenario[] = [
  drawer({
    id: 'AddScopeMissing',
    title: 'إضافة: دور بلا فرع',
    steps: [
      ...add,
      { fill: 'memberName', value: NAME },
      { fill: 'memberPhone', value: FREE },
      { click: '[data-testid="role-receptionist"] label' },
      { press: 'addSubmit' },
    ],
  }),
  drawer({
    id: 'AddPhoneInvalid',
    title: 'إضافة: رقم غير صالح',
    steps: [...addFilled, { fill: 'memberPhone', value: '0912' }, { press: 'addSubmit' }],
  }),
  drawer({
    id: 'AddSending',
    title: 'إضافة: جارٍ الإرسال',
    answers: { 'POST /team/members': 'hold' },
    steps: submit,
  }),
  refusal(
    'AddBranchArchived',
    'إضافة مرفوضة: الفرع أُرشف',
    'POST /team/members',
    [fail(409, 'branch_archived')],
    submit,
  ),
  refusal(
    'AddServerError',
    'إضافة: خطأ في الخادم',
    'POST /team/members',
    [fail(500, 'internal_error')],
    submit,
  ),
  drawer({ id: 'FixPhoneIssued', title: 'تصحيح الرقم: رابط جديد', steps: fixTo(FREE) }),
  fixRefused('FixPhoneAccepted', 'تصحيح الرقم: العضو قبل الدعوة', [
    fail(409, 'member_account_exists'),
  ]),
  fixRefused('FixPhoneDeactivated', 'تصحيح الرقم: الدعوة أُلغيت', [fail(409, 'member_deactivated')]),
  fixRefused('FixPhoneOffline', 'تصحيح الرقم: لا اتصال', ['offline']),
  fixRefused('FixPhoneServerError', 'تصحيح الرقم: خطأ في الخادم', [fail(500, 'internal_error')]),
  fixRefused('FixPhoneGone', 'تصحيح الرقم: العضو لم يعد في الفريق', [fail(404, 'not_found')]),
];
