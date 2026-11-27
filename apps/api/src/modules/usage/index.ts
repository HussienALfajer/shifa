// Public surface of the usage module: other code imports from here, never from its files.
export { type ClinicActivity, clinicActivity } from './admin.service.ts';
export { addDays, damascusDay } from './day.ts';
export {
  LAST_ACTIVITY_KEY,
  recordActivity,
  recordGauges,
  recordSignIn,
  USAGE_KEYS,
  type UsageKey,
} from './record.ts';
export { UsageModule } from './usage.module.ts';
