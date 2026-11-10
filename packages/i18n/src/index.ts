// Public surface of @shifa/i18n: the source loader, the checks and the generated key types.
// The messages themselves are the JSON files under src/locales (exported as ./locales/*).
export type { MessageKeys, Namespace } from '../generated/keys.ts';
export {
  checkErrorCodes,
  checkIcu,
  checkParity,
  checkPlurals,
  checkValues,
  LATIN_ALLOWED,
} from './checks.ts';
export { type PlaceholderType, parseMessage, placeholders } from './icu.ts';
export {
  BASE_LOCALE,
  formatProblem,
  LOCALES_DIR,
  loadSources,
  type Messages,
  type Problem,
  type Sources,
} from './sources.ts';
