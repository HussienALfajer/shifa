// @shifa/i18n/runtime: the web apps' translator (slice A-01-06). One i18next instance per call,
// with ICU MessageFormat (i18next-icu, tags left as text), Arabic by default, every namespace of
// src/locales loaded synchronously, numbers in Western digits (OD-20).
import i18next, { type i18n } from 'i18next';
import ICU from 'i18next-icu';
import type { CommonKey, Namespace } from '../generated/keys.ts';
import common from './locales/ar/common.json' with { type: 'json' };
import errors from './locales/ar/errors.json' with { type: 'json' };

export type { i18n as I18n } from 'i18next';

/** The locale plural rules and numbers are formatted in: Arabic, Latin digits (OD-20). */
export const FORMAT_LOCALE = 'ar-SY-u-nu-latn';

const RESOURCES = { ar: { common, errors } } satisfies Record<string, Record<Namespace, object>>;

/** Keys of `common` the web shell renders (slice A-01-06); the test checks each exists. */
export const SHELL_KEYS = [
  'signInTitle',
  'signInPending',
  'mfaTitle',
  'mfaPending',
  'setupTitle',
  'setupPending',
  'homeTitle',
  'homePending',
  'aboutTitle',
  'aboutVersion',
  'aboutIcons',
  'aboutLicence',
  'adminWebTitle',
  'adminWebBody',
  'signedInAs',
  'signOut',
  'mfaStateNone',
  'mfaStatePending',
  'mfaStateVerified',
  'mfaRequiredNote',
  'reasonSessionExpired',
  'reasonIdle',
  'reasonNotAdmin',
  'reasonSignedOut',
  'reasonSignOutFailed',
  'idleWarning',
  'theme',
  'themeLight',
  'themeDark',
  'themeSystem',
  'notFound',
] as const satisfies readonly CommonKey[];

export function createI18n(): i18n {
  const instance = i18next.createInstance();
  void instance.use(ICU).init({
    lng: 'ar',
    fallbackLng: 'ar',
    supportedLngs: ['ar'],
    ns: ['common', 'errors'],
    defaultNS: 'common',
    resources: RESOURCES,
    initAsync: false,
    // React escapes; ICU never sees HTML.
    interpolation: { escapeValue: false },
    i18nFormat: { parseLngForICU: () => FORMAT_LOCALE },
    returnNull: false,
  });
  return instance;
}
