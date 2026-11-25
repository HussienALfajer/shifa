// The clinic chooser (/choose, A-01-07 checkpoint 4 and A-01-08) and the header switcher
// (A-01-08): src/chooser/ and src/switcher/clinic-switcher.tsx, every state and every refusal of
// POST /me/switch.
import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { at, B_SECOND, CLINIC, OTHER_CLINIC, ownerSession } from '../world.ts';

const noClinicYet = (w: World) => {
  w.session = ownerSession({ tenantId: null, branchId: null, roles: [] });
};
const choose = (s: Omit<Scenario, 'path'>): Scenario => ({
  path: '/choose',
  world: noClinicYet,
  ...s,
});
const branchStep: Step[] = [{ pressIn: OTHER_CLINIC }, { until: 'branchTitle' }];
const refused = (
  id: string,
  title: string,
  answer: ReturnType<typeof fail>,
  steps: Step[],
): Scenario => choose({ id, title, answers: { 'POST /me/switch': [answer] }, steps });

export const chooser: Sheet = {
  id: 'Chooser',
  title: 'اختيار العيادة',
  route: '/choose',
  note: 'After sign-in without a clinic: the person’s clinics (last used first, a suspended one listed but off) and pending invitations, the branch step for roles in two or more branches, opening a clinic, no clinic at all, and every refusal of the switch (suspended, branch archived, branch not held, clinic gone, no network, server error).',
  code: ['chooser/clinic-chooser.tsx', 'chooser/chooser-cards.tsx', 'chooser/use-clinic-switch.ts'],
  scenarios: [
    choose({ id: 'List', title: 'العيادات والدعوات' }),
    choose({ id: 'Loading', title: 'تحميل العيادات', answers: { 'GET /me/clinics': 'hold' } }),
    choose({
      id: 'LoadFailed',
      title: 'تعذّر تحميل العيادات',
      answers: { 'GET /me/clinics': ['offline'] },
    }),
    choose({
      id: 'ListServerError',
      title: 'تحميل العيادات: خطأ في الخادم',
      answers: { 'GET /me/clinics': [fail(500, 'internal_error')] },
    }),
    choose({
      id: 'NoName',
      title: 'دون اسم الشخص (تعذّرت قراءته)',
      answers: { 'GET /me': fail(500, 'internal_error') },
    }),
    choose({
      id: 'Trial',
      title: 'عيادة في فترة التجربة',
      world: (w) => {
        noClinicYet(w);
        const [first, ...rest] = w.clinics;
        if (first) w.clinics = [{ ...first, status: 'trial' }, ...rest];
      },
    }),
    choose({
      id: 'OnlyInvitations',
      title: 'دعوات فقط، بلا عيادة بعد',
      world: (w) => {
        noClinicYet(w);
        w.clinics = [];
      },
    }),
    choose({
      id: 'SessionEnds',
      title: 'تنتهي الساعات الاثنتا عشرة قريبًا',
      world: (w) => {
        w.session = ownerSession({
          tenantId: null,
          branchId: null,
          roles: [],
          absoluteExpiresAt: at(8 * 60_000),
        });
      },
    }),
    choose({
      id: 'NoClinic',
      title: 'لا عيادة ولا دعوة',
      world: (w) => {
        noClinicYet(w);
        w.clinics = [];
        w.invitations = [];
      },
    }),
    choose({ id: 'Branch', title: 'اختيار الفرع', steps: branchStep }),
    choose({
      id: 'Opening',
      title: 'جارٍ فتح العيادة',
      answers: { 'POST /me/switch': 'hold' },
      steps: [{ pressIn: CLINIC }],
    }),
    refused('Suspended', 'العيادة موقوفة الآن', fail(403, 'clinic_suspended'), [
      { pressIn: CLINIC },
    ]),
    refused('Archived', 'الفرع أُرشف للتو', fail(409, 'branch_archived'), [
      ...branchStep,
      { pressIn: 'فرع الفرقان' },
    ]),
    refused('NotHeld', 'لم يعد لك دور في الفرع', fail(403, 'branch_not_held'), [
      ...branchStep,
      { pressIn: 'فرع الفرقان' },
    ]),
    refused('Gone', 'لم تعد العيادة من عياداتك', fail(404, 'not_found'), [{ pressIn: CLINIC }]),
    refused('BranchRequired', 'الخادم يطلب اختيار الفرع', fail(400, 'branch_required'), [
      { pressIn: CLINIC },
    ]),
    refused('Refused', 'تبديل مرفوض لسبب آخر', fail(403, 'forbidden'), [{ pressIn: CLINIC }]),
    choose({
      id: 'BranchOffline',
      title: 'خطوة الفرع: لا اتصال',
      answers: { 'POST /me/switch': ['offline'] },
      steps: [...branchStep, { pressIn: 'فرع الفرقان' }],
    }),
    choose({
      id: 'Offline',
      title: 'لا اتصال بالخادم',
      answers: { 'POST /me/switch': ['offline'] },
      steps: [{ pressIn: CLINIC }],
    }),
    refused('ServerError', 'خطأ في الخادم', fail(500, 'internal_error'), [{ pressIn: CLINIC }]),
  ],
};

const openMenu: Step = { click: 'header [aria-haspopup="menu"]' };
const home = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/', ...s });
const toSecond: Step[] = [openMenu, { pressIn: B_SECOND.name }];
const toOther: Step[] = [openMenu, { pressIn: OTHER_CLINIC }, { pressIn: 'فرع الفرقان' }];
const switchRefused = (
  id: string,
  title: string,
  answer: ReturnType<typeof fail>,
  steps: Step[],
): Scenario => home({ id, title, answers: { 'POST /me/switch': [answer] }, steps, overlay: true });

export const switcher: Sheet = {
  id: 'Switcher',
  title: 'مبدّل العيادة والفرع',
  route: 'header',
  note: 'The switcher in the header of every signed-in page: closed, open (clinics, the branches of this clinic, invitations), the branch step, switching, the «you are now in» toast, and a refused switch; a person with one clinic and one branch sees the clinic’s name only.',
  code: ['switcher/clinic-switcher.tsx', 'chooser/use-clinic-switch.ts', 'account/app-frame.tsx'],
  scenarios: [
    home({ id: 'Open', title: 'القائمة مفتوحة', steps: [openMenu], overlay: true }),
    home({
      id: 'BranchStep',
      title: 'خطوة الفرع في عيادة أخرى',
      steps: [openMenu, { pressIn: OTHER_CLINIC }, { until: 'switcherStepText' }],
      overlay: true,
    }),
    home({
      id: 'Switching',
      title: 'جارٍ التبديل',
      answers: { 'POST /me/switch': 'hold' },
      steps: [openMenu, { pressIn: B_SECOND.name }],
      overlay: true,
    }),
    home({
      id: 'Switched',
      title: 'أنت الآن في … (إشعار)',
      steps: [
        openMenu,
        { pressIn: B_SECOND.name },
        { until: 'switcherNowIn', values: { clinic: CLINIC } },
      ],
      overlay: true,
    }),
    home({
      id: 'Refused',
      title: 'تبديل مرفوض: العيادة موقوفة',
      answers: { 'POST /me/switch': [fail(403, 'clinic_suspended')] },
      steps: [openMenu, { pressIn: OTHER_CLINIC }, { pressIn: 'فرع الفرقان' }],
      overlay: true,
    }),
    switchRefused('Archived', 'تبديل مرفوض: الفرع أُرشف', fail(409, 'branch_archived'), toOther),
    switchRefused(
      'NotHeld',
      'تبديل مرفوض: لم يعد لك دور في الفرع',
      fail(403, 'branch_not_held'),
      toOther,
    ),
    switchRefused(
      'BranchRequired',
      'الخادم يطلب اختيار الفرع',
      fail(400, 'branch_required'),
      toSecond,
    ),
    switchRefused('Gone', 'تبديل مرفوض: العيادة لم تعد لك', fail(404, 'not_found'), toSecond),
    switchRefused('Other', 'تبديل مرفوض لسبب آخر', fail(400, 'bad_request'), toSecond),
    switchRefused('ServerError', 'تبديل: خطأ في الخادم', fail(500, 'internal_error'), toSecond),
    home({
      id: 'Offline',
      title: 'تبديل: لا اتصال',
      answers: { 'POST /me/switch': ['offline'] },
      steps: toSecond,
      overlay: true,
    }),
    home({
      id: 'OneClinicBranches',
      title: 'عيادة واحدة بعدة فروع',
      world: (w) => {
        w.clinics = w.clinics.slice(0, 1);
        w.invitations = [];
      },
      steps: [openMenu],
      overlay: true,
    }),
    home({
      id: 'OneClinic',
      title: 'عيادة واحدة وفرع واحد: الاسم فقط',
      world: (w) => {
        const [first] = w.clinics;
        if (first) w.clinics = [{ ...first, solo: true, branches: first.branches.slice(0, 1) }];
        w.invitations = [];
      },
    }),
  ],
};
