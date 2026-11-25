// The owner's team (/team, A-01-08): src/team/ — the list (table on a desktop, cards on a phone)
// with its filter and search, one drawer to add or edit a member, the account actions, the phone
// fix, and the leave guard of an unsent link.
import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import {
  ACCOUNTANT,
  ASSISTANT,
  B_SECOND,
  DOCTOR,
  LEFT,
  local,
  NEW_PHONE,
  OWNER_NAME,
  RECEPTION,
} from '../world.ts';

const team = (s: Omit<Scenario, 'path'> & { path?: string }): Scenario => ({ path: '/team', ...s });
const open = (name: string): Step[] => [{ pressText: name }, { until: 'memberAccount' }];
const add: Step[] = [{ press: 'teamAdd' }, { until: 'addTitle' }];
const NAME = 'سلمى حدّاد';
const addFilled: Step[] = [
  ...add,
  { fill: 'memberName', value: NAME },
  { fill: 'memberPhone', value: local(NEW_PHONE) },
  { click: '[data-testid="role-receptionist"] label' },
  { check: B_SECOND.name, within: '[data-testid="role-receptionist"]' },
];
const issueLink: Step[] = [
  ...open(RECEPTION.name),
  { press: 'memberNewLink' },
  { press: 'memberLinkAction' },
  { until: 'linkCopy' },
];
const fixPhone: Step[] = [...open(ACCOUNTANT.name), { press: 'memberFixPhone' }];

export const teamSheet: Sheet = {
  id: 'Team',
  title: 'الفريق',
  route: '/team',
  note: 'The owner’s team: all members with role, branch, status and last activity, filtered by status or searched, or one branch’s team; loading, failed, only the owner; the drawer of each kind of member (active, pending, expired link, deactivated, the owner), its account actions and their questions, a new link with copy and WhatsApp and the guard before leaving it unsent; the phone fix; adding a member with every refusal.',
  code: [
    'team/team-page.tsx',
    'team/team-rows.tsx',
    'team/member-drawer.tsx',
    'team/member-form.tsx',
    'team/member-account.tsx',
    'team/roles-field.tsx',
    'team/permissions-field.tsx',
    'team/add-member.tsx',
    'team/member-phone-dialog.tsx',
    'admin/link-shown.tsx',
  ],
  scenarios: [
    team({ id: 'List', title: 'كل الأعضاء' }),
    team({ id: 'Loading', title: 'تحميل الفريق', answers: { 'GET /team/members': 'hold' } }),
    team({
      id: 'LoadFailed',
      title: 'تعذّر تحميل الفريق',
      answers: { 'GET /team/members': 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    team({
      id: 'OnlyOwner',
      title: 'المالك وحده',
      world: (w: World) => {
        w.members = w.members.filter((m) => m.isSelf);
      },
    }),
    team({
      id: 'Pending',
      title: 'تصفية: بانتظار القبول',
      steps: [{ press: 'teamFilterPending', values: { count: 2 } }],
    }),
    team({
      id: 'NoMatch',
      title: 'بحث بلا نتيجة',
      steps: [{ fillIn: 'input[type="search"], input[placeholder]', value: 'زياد' }],
    }),
    team({ id: 'Branch', title: 'فريق فرع واحد', path: `/team?branch=${B_SECOND.id}` }),
    team({
      id: 'Active',
      title: 'درج عضو فعّال',
      steps: open(DOCTOR.name),
      overlay: true,
    }),
    team({
      id: 'NoMfa',
      title: 'درج عضو بلا تحقق بخطوتين',
      steps: open(ASSISTANT.name),
      overlay: true,
    }),
    team({
      id: 'PendingMember',
      title: 'درج عضو بانتظار القبول',
      steps: open(RECEPTION.name),
      overlay: true,
    }),
    team({
      id: 'Expired',
      title: 'درج عضو انتهى رابطه',
      steps: open(ACCOUNTANT.name),
      overlay: true,
    }),
    team({ id: 'Deactivated', title: 'درج عضو موقوف', steps: open(LEFT.name), overlay: true }),
    team({ id: 'Self', title: 'درج المالك نفسه', steps: open(OWNER_NAME), overlay: true }),
    team({
      id: 'MemberLoading',
      title: 'تحميل العضو',
      answers: { 'GET /team/members/:id': 'hold' },
      steps: [{ pressText: DOCTOR.name }],
      overlay: true,
    }),
    team({
      id: 'DeactivateAsk',
      title: 'سؤال قبل إيقاف الحساب',
      steps: [...open(DOCTOR.name), { press: 'memberDeactivate' }],
      overlay: true,
    }),
    team({
      id: 'ResetMfaAsk',
      title: 'سؤال قبل إعادة ضبط التحقق',
      steps: [...open(DOCTOR.name), { press: 'memberResetMfa' }],
      overlay: true,
    }),
    team({
      id: 'LinkIssued',
      title: 'رابط جديد: نسخ أو واتساب',
      steps: issueLink,
      overlay: true,
    }),
    team({
      id: 'LinkLeave',
      title: 'إغلاق قبل نسخ الرابط',
      steps: [...issueLink, { press: 'close' }],
      overlay: true,
    }),
    team({
      id: 'RolesSaved',
      title: 'تعديل الأدوار والصلاحيات',
      steps: [...open(DOCTOR.name), { click: '[data-testid="role-assistant"] label' }],
      overlay: true,
    }),
    team({ id: 'FixPhone', title: 'تصحيح رقم عضو بانتظار القبول', steps: fixPhone, overlay: true }),
    team({
      id: 'FixPhoneInvalid',
      title: 'تصحيح الرقم: رقم غير صالح',
      steps: [
        ...fixPhone,
        { fill: 'memberFixPhoneField', value: '0912' },
        { press: 'memberFixPhoneAction' },
      ],
      overlay: true,
    }),
    team({
      id: 'FixPhoneInTeam',
      title: 'تصحيح الرقم: الرقم لعضو آخر',
      steps: [
        ...fixPhone,
        { fill: 'memberFixPhoneField', value: local(DOCTOR.phone) },
        { press: 'memberFixPhoneAction' },
      ],
      overlay: true,
    }),
    team({ id: 'Add', title: 'إضافة موظف', steps: add, overlay: true }),
    team({
      id: 'AddMissing',
      title: 'إضافة: حقول ناقصة',
      steps: [...add, { press: 'addSubmit' }],
      overlay: true,
    }),
    team({
      id: 'AddFilled',
      title: 'إضافة: الاسم والرقم والدور والفرع',
      steps: addFilled,
      overlay: true,
    }),
    team({
      id: 'AddInTeam',
      title: 'إضافة: الرقم لعضو في الفريق',
      answers: { 'POST /team/members': [fail(409, 'phone_in_team')] },
      steps: [...addFilled, { press: 'addSubmit' }],
      overlay: true,
    }),
    team({
      id: 'AddOffline',
      title: 'إضافة: انقطع الاتصال',
      answers: { 'POST /team/members': ['offline'] },
      steps: [...addFilled, { press: 'addSubmit' }],
      overlay: true,
    }),
    team({
      id: 'Added',
      title: 'أُضيف الموظف: رابطه',
      steps: [...addFilled, { press: 'addSubmit' }, { until: 'linkCopy' }],
      overlay: true,
    }),
  ],
};
