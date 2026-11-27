// Every sheet of the screens canvases, in the order a person meets them: "Clinic Web Screens" on
// "Shifa Screens · Clinic web" and "Admin Web Screens" on "Shifa Screens · Admin web". One bundle
// holds both apps; a sheet's id is unique across them and names the app it runs.
import type { Sheet } from '../scenario.ts';
import type { ScreensApp } from '../state.ts';
import { A02_CLINIC_SHEETS } from './a02.ts';
import { accountSheet, settingsSheet } from './account.ts';
import { ADMIN_SHEETS } from './admin/index.ts';
import { branchesSheet } from './branches.ts';
import { chooser, switcher } from './chooser.ts';
import { homeSheet, otherPages } from './home.ts';
import { mfaChallenge, mfaEnrol } from './mfa.ts';
import { invitation, setupLink } from './setup.ts';
import { signIn } from './sign-in.ts';
import { teamSheet } from './team.ts';

/** Clinic web's sheets. */
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
  ...A02_CLINIC_SHEETS,
  otherPages,
];

export { ADMIN_SHEETS };

export const SHEETS_OF: Record<ScreensApp, Sheet[]> = { clinic: SHEETS, admin: ADMIN_SHEETS };

/** A sheet of either app by its id, and the app it runs. */
export function findSheet(id: string): { sheet: Sheet; app: ScreensApp } | undefined {
  for (const app of ['clinic', 'admin'] as const) {
    const sheet = SHEETS_OF[app].find((s) => s.id === id);
    if (sheet) return { sheet, app };
  }
  return undefined;
}
