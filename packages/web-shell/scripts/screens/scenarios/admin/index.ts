// Every sheet of the "Admin Web Screens" page, in the order a super admin meets them.
import type { Sheet } from '../../scenario.ts';
import { A02_ADMIN_SHEETS } from './a02.ts';
import { adminMfaChallenge, adminMfaEnrol, adminSetupLink, adminSignIn } from './auth.ts';
import { clinicSheet, linkShownSheet, ownerCardSheet, phoneDialogSheet } from './clinic.ts';
import { clinicsSheet, createClinicSheet } from './clinics.ts';
import { adminOtherSheet } from './other.ts';
import { TAB_SHEETS } from './tabs.ts';

export const ADMIN_SHEETS: Sheet[] = [
  adminSignIn,
  adminSetupLink,
  adminMfaChallenge,
  adminMfaEnrol,
  clinicsSheet,
  createClinicSheet,
  clinicSheet,
  ownerCardSheet,
  phoneDialogSheet,
  linkShownSheet,
  ...TAB_SHEETS,
  ...A02_ADMIN_SHEETS,
  adminOtherSheet,
];
