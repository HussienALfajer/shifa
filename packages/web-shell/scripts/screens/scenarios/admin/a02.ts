// Admin web's flags, announcements, cities and areas (A-02-09), in the order of the navigation.
import type { Sheet } from '../../scenario.ts';
import { announcementDialogSheet, announcementsSheet } from './announcements.ts';
import { flagDialogSheet, flagsSheet } from './flags.ts';
import { placeDialogsSheet, placesSheet } from './places.ts';

export const A02_ADMIN_SHEETS: Sheet[] = [
  flagsSheet,
  flagDialogSheet,
  announcementsSheet,
  announcementDialogSheet,
  placesSheet,
  placeDialogsSheet,
];
