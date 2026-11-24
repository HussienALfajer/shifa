// The shell's texts (slice A-01-06), typed by the keys of `common`; error codes by `errors`.
import type { CommonKey } from '@shifa/i18n';
import { useTranslation } from 'react-i18next';

export function useText(): (key: CommonKey, values?: Record<string, unknown>) => string {
  const { t } = useTranslation('common');
  return (key, values) => t(key, values ?? {});
}

/** The Arabic text of an API error code (`errors` namespace, one key per `ErrorCode`). */
export function useErrorText(): (code: string) => string {
  const { t } = useTranslation('errors');
  return (code) => t(code, { defaultValue: t('internal_error') });
}
