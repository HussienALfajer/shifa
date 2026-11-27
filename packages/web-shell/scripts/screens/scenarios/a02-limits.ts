// The plan's limits on the owner's team and branches (A-02-10, contract rows "Team form · limit
// before sending" and "after sending", "Branches · limit"; approved board `A02cLimits`): the doctor
// role disabled at a full limit with its Callout, a deactivated doctor not reactivated, «إضافة فرع»
// disabled at the branches' limit; and the 409 `limit_reached` of an add, a reactivation or a
// restore after the limit filled meanwhile, which names it and saves nothing. The states join the
// Team and Branches sheets (team.ts, branches.ts).

import { fillLimit, limitReached } from '../routes-a02-clinic.ts';
import type { Answer, Scenario, Step, World } from '../scenario.ts';
import { B_MAIN, B_OLD, B_THIRD, LEFT, local, NEW_PHONE } from '../world.ts';
import { BRANCHES, PRACTITIONERS } from '../world-a02-clinic.ts';
import { add, NAME, open, team } from './team-steps.ts';

const DIALOG = '[role="alertdialog"]';

/** The limit filled meanwhile (another tab or device): the server refuses and names it. */
const filledMeanwhile =
  (key: string): Answer =>
  (_request, world) => {
    fillLimit(world, key);
    return limitReached(world, key);
  };

/** The member who left the team was a doctor: reactivating them takes a doctor's place. */
const leftWasDoctor = (w: World) => {
  const m = w.members.find((x) => x.id === LEFT.id);
  if (m) m.roles = [{ role: 'doctor', branchId: B_THIRD.id, branchName: B_THIRD.name }];
};

const addDoctor: Step[] = [
  ...add,
  { fill: 'memberName', value: NAME },
  { fill: 'memberPhone', value: local(NEW_PHONE) },
  { click: '[data-testid="role-doctor"] label' },
  { check: B_MAIN.name, within: '[data-testid="role-doctor"]' },
  { press: 'addSubmit' },
];
const reactivateAsk: Step[] = [...open(LEFT.name), { press: 'memberReactivate' }];

export const teamLimits: Scenario[] = [
  team({
    id: 'DoctorsFull',
    title: 'إضافة موظف: حد الأطباء ممتلئ',
    overlay: true,
    world: (w) => {
      fillLimit(w, PRACTITIONERS);
    },
    steps: add,
  }),
  team({
    id: 'DoctorLimitRefused',
    title: 'إضافة طبيب: امتلأ الحد في الأثناء، لم يُحفظ شيء',
    overlay: true,
    answers: { 'POST /team/members': filledMeanwhile(PRACTITIONERS) },
    steps: [...addDoctor, { until: 'limitNotSaved' }],
  }),
  team({
    id: 'ReactivateFull',
    title: 'إعادة تفعيل طبيب: الحد ممتلئ',
    overlay: true,
    world: (w) => {
      leftWasDoctor(w);
      fillLimit(w, PRACTITIONERS);
    },
    steps: [...open(LEFT.name), { until: 'limitReactivateTitle' }],
  }),
  team({
    id: 'ReactivateLimitRefused',
    title: 'إعادة تفعيل طبيب: امتلأ الحد في الأثناء',
    overlay: true,
    world: leftWasDoctor,
    answers: { 'POST /team/members/:id/reactivate': filledMeanwhile(PRACTITIONERS) },
    steps: [
      ...reactivateAsk,
      { press: 'memberReactivate', within: DIALOG },
      { until: 'limitNotSaved' },
    ],
  }),
];

const branches = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/branches', ...s });
const addFilled: Step[] = [
  { press: 'branchesAdd' },
  { until: 'branchAddTitle' },
  { fill: 'branchName', value: 'فرع الحمدانية' },
  { press: 'branchAddSubmit' },
];

export const branchLimits: Scenario[] = [
  branches({
    id: 'BranchesFull',
    title: 'حد الفروع ممتلئ: «إضافة فرع» معطّل',
    world: (w) => {
      fillLimit(w, BRANCHES);
    },
  }),
  branches({
    id: 'AddLimitRefused',
    title: 'إضافة فرع: امتلأ الحد في الأثناء',
    overlay: true,
    answers: { 'POST /branches': filledMeanwhile(BRANCHES) },
    steps: [...addFilled, { until: 'limitBranchNotAdded' }],
  }),
  branches({
    id: 'RestoreLimitRefused',
    title: 'استعادة فرع: حد الفروع ممتلئ',
    answers: { 'POST /branches/:id/restore': filledMeanwhile(BRANCHES) },
    steps: [
      { press: 'branchRestore' },
      { until: 'limitRestoreRefused', values: { name: B_OLD.name } },
    ],
  }),
];
