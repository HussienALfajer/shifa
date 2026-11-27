// Clinic web's A-02 items (A-02-10) that are sheets of their own: the support session, what the
// owner sees while support reads the clinic, and Shifa's announcements. The limits, the places and
// the subscription join the Team, Branches and Settings sheets (a02-limits.ts, a02-places.ts,
// a02-settings.ts).
import type { Sheet } from '../scenario.ts';
import { announcementsSheet, ownerSupportSheet } from './a02-banners.ts';
import { supportSessionSheet } from './a02-support.ts';

export const A02_CLINIC_SHEETS: Sheet[] = [
  announcementsSheet,
  ownerSupportSheet,
  supportSessionSheet,
];
