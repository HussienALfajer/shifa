// Public surface of the settings module: other code imports from here, never from its files.
export {
  assertSettingKeysKnown,
  IDLE_MINUTES_KEY,
  InvalidSettingError,
  PRODUCTION_SETTINGS,
  SETTING_CATALOGUE,
  SETTING_SCOPES,
  SettingCatalogue,
  type SettingDefinition,
  type SettingScope,
} from './catalogue.ts';
export { idleMinutesInClinic, idleMinutesOfOwnClinics, idleSettingInClinic } from './idle.ts';
export {
  heldLock,
  type Resolution,
  resolveSetting,
  resolveWithLocks,
  type ScopedValue,
  type WriteRefusal,
  writeRefusal,
} from './resolve.ts';
export { SettingsModule } from './settings.module.ts';
