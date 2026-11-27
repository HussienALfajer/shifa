// Public surface of the flags module: other code imports from here, never from its files.
export {
  FLAG_CATALOGUE,
  FlagCatalogue,
  type FlagDefinition,
  PRODUCTION_FLAGS,
  UnknownFlagError,
} from './catalogue.ts';
export { CachedFlags, FLAGS, type FlagClient, type FlagRowsLoader } from './client.ts';
export { evaluateAll, evaluateFlag, type TenantFlagRows } from './evaluate.ts';
export { FlagsModule } from './flags.module.ts';
