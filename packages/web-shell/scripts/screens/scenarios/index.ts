// Every sheet of the "Clinic Web Screens" page, in the order a person meets them.
import type { Sheet } from '../scenario.ts';
import { accountSheet, settingsSheet } from './account.ts';
import { branchesSheet } from './branches.ts';
import { chooser, switcher } from './chooser.ts';
import { homeSheet, otherPages } from './home.ts';
import { mfaChallenge, mfaEnrol } from './mfa.ts';
import { invitation, setupLink } from './setup.ts';
import { signIn } from './sign-in.ts';
import { teamSheet } from './team.ts';

export const SHEETS: Sheet[] = [
  signIn,
  setupLink,
  invitation,
  mfaChallenge,
  mfaEnrol,
  chooser,
  homeSheet,
  switcher,
  teamSheet,
  branchesSheet,
  accountSheet,
  settingsSheet,
  otherPages,
];
