// The clinic's settings after A-02 (A-02-10, contract rows "Settings · «الاشتراك»" and the idle
// setting's source and lock; approved board `A02cSettings`): «الاشتراك» with its plan, status, end
// and each limit's meter (full in the warning colour with its line, the end within 14 days warned,
// loading, failed); the idle limit's source, the super admin's lock (choices off, «مقفل من
// الإدارة», no «حفظ») and a lock set meanwhile (409 `setting_locked`, read again). The states join
// the Settings sheet (account.ts).

import { fillLimit } from '../routes-a02-clinic.ts';
import type { Answer, Scenario, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { BRANCHES, damascusDay, PRACTITIONERS } from '../world-a02-clinic.ts';

const settings = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/settings', ...s });
const pick = (minutes: number): Step => ({ check: `${String(minutes)} ` });
const SUBSCRIPTION = 'GET /clinic/subscription';

/** The super admin locked the idle limit at 60 minutes (A-02-04's cascade). */
const lockedAt60 = (w: World) => {
  w.settings = { idleMinutes: 60, source: 'organization', locked: true };
};

/** Locked meanwhile: the save is refused and the next read shows the lock. */
const lockedMeanwhile: Answer = (_request, world) => {
  lockedAt60(world);
  return fail(409, 'setting_locked');
};

export const settingsA02: Scenario[] = [
  settings({
    id: 'SubFull',
    title: 'الاشتراك: حدّا الأطباء والفروع ممتلئان',
    world: (w) => {
      fillLimit(w, PRACTITIONERS);
      fillLimit(w, BRANCHES);
    },
  }),
  settings({
    id: 'SubEnding',
    title: 'الاشتراك التجريبي ينتهي خلال 6 أيام',
    world: (w) => {
      w.clinicA02.status = 'trial';
      w.clinicA02.plan = 'multi_doctor';
      w.clinicA02.limits = {
        ...w.clinicA02.limits,
        'limits.practitioners': 10,
        'limits.branches': 3,
      };
      w.clinicA02.subscriptionEnd = damascusDay(6);
    },
  }),
  settings({ id: 'SubLoading', title: 'تحميل الاشتراك', answers: { [SUBSCRIPTION]: 'hold' } }),
  settings({
    id: 'SubFailed',
    title: 'تعذّر تحميل الاشتراك',
    answers: { [SUBSCRIPTION]: 'offline' },
    steps: [{ until: 'loadFailedTitle' }],
  }),
  settings({
    id: 'IdleDefault',
    title: 'مهلة عدم النشاط من الإعداد الافتراضي',
    world: (w) => {
      w.settings = { idleMinutes: 30, source: 'default', locked: false };
    },
  }),
  settings({ id: 'IdleLocked', title: 'المهلة مقفلة من الإدارة', world: lockedAt60 }),
  settings({
    id: 'IdleLockedMeanwhile',
    title: 'قُفلت المهلة في الأثناء: لم يُحفظ شيء',
    answers: { 'PATCH /clinic/settings': lockedMeanwhile },
    steps: [pick(30), { press: 'save' }, { until: 'idleLockedMeanwhile' }],
  }),
];
