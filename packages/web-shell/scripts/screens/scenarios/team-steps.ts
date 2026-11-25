// The steps the team's states share: opening a member's drawer, the add drawer filled in, a new
// link issued, the phone fix opened.
import type { Scenario, Step } from '../scenario.ts';
import { ACCOUNTANT, B_SECOND, local, NEW_PHONE, RECEPTION } from '../world.ts';

export const team = (s: Omit<Scenario, 'path'> & { path?: string }): Scenario => ({
  path: '/team',
  ...s,
});
export const open = (name: string): Step[] => [{ pressText: name }, { until: 'memberAccount' }];
export const add: Step[] = [{ press: 'teamAdd' }, { until: 'addTitle' }];
export const NAME = 'سلمى حدّاد';
export const addFilled: Step[] = [
  ...add,
  { fill: 'memberName', value: NAME },
  { fill: 'memberPhone', value: local(NEW_PHONE) },
  { click: '[data-testid="role-receptionist"] label' },
  { check: B_SECOND.name, within: '[data-testid="role-receptionist"]' },
];
export const issueLink: Step[] = [
  ...open(RECEPTION.name),
  { press: 'memberNewLink' },
  { press: 'memberLinkAction' },
  { until: 'linkCopy' },
];
export const fixPhone: Step[] = [...open(ACCOUNTANT.name), { press: 'memberFixPhone' }];
