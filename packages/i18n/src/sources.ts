// The translation source: src/locales/<locale>/<namespace>.json, each a flat object of
// key → ICU MessageFormat string. Arabic (`ar`) is the base locale every other one follows.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** key → ICU message */
export type Messages = Record<string, string>;
/** locale → namespace → messages */
export type Sources = Record<string, Record<string, Messages>>;

export const BASE_LOCALE = 'ar';
export const LOCALES_DIR = join(import.meta.dirname, 'locales');

/** Keys are identifiers: they become ARB names and TypeScript literal types. */
export const KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;
/** Namespaces prefix ARB names and name TypeScript types: lower camelCase. */
export const NAMESPACE_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/** One finding of a check: the file (`<locale>/<namespace>.json`), the key and what is wrong. */
export interface Problem {
  file: string;
  key: string;
  message: string;
}

export function fileOf(locale: string, namespace: string): string {
  return `${locale}/${namespace}.json`;
}

export function formatProblem(p: Problem): string {
  return `${p.file} › ${p.key}: ${p.message}`;
}

/** Reads every locale directory. Throws on a value that is not a string or a malformed key. */
export function loadSources(dir: string = LOCALES_DIR): Sources {
  const sources: Sources = {};
  for (const locale of readdirSync(dir).sort()) {
    if (!statSync(join(dir, locale)).isDirectory()) continue;
    if (!isCanonicalLocale(locale)) {
      throw new Error(`${locale}/: locale folder must be a canonical BCP 47 tag (ar, tr, ar-SY)`);
    }
    const namespaces: Record<string, Messages> = {};
    for (const file of readdirSync(join(dir, locale)).sort()) {
      if (!file.endsWith('.json')) continue;
      const raw: unknown = JSON.parse(readFileSync(join(dir, locale, file), 'utf8'));
      const namespace = file.slice(0, -'.json'.length);
      if (!NAMESPACE_PATTERN.test(namespace)) {
        throw new Error(`${locale}/${file}: namespace must match ${NAMESPACE_PATTERN.source}`);
      }
      namespaces[namespace] = toMessages(raw, fileOf(locale, namespace));
    }
    sources[locale] = namespaces;
  }
  return sources;
}

function isCanonicalLocale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale)[0] === locale;
  } catch {
    return false;
  }
}

function toMessages(raw: unknown, file: string): Messages {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${file}: expected a flat object of key → message`);
  }
  const messages: Messages = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') throw new Error(`${file} › ${key}: value must be a string`);
    if (!KEY_PATTERN.test(key))
      throw new Error(`${file} › ${key}: key must match ${KEY_PATTERN.source}`);
    messages[key] = value;
  }
  return messages;
}

/** Every message of every locale, with its file. */
export function* eachMessage(
  sources: Sources,
): Generator<{ locale: string; namespace: string; file: string; key: string; message: string }> {
  for (const [locale, namespaces] of Object.entries(sources)) {
    for (const [namespace, messages] of Object.entries(namespaces)) {
      for (const [key, message] of Object.entries(messages)) {
        yield { locale, namespace, file: fileOf(locale, namespace), key, message };
      }
    }
  }
}
