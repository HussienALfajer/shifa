// The translation checks run by this package's tests (and so by `verify` and CI). Each is a pure
// function of the source returning problems by file and key; an empty list means it passes.
import { isPoundElement } from '@formatjs/icu-messageformat-parser';
import { parseMessage, placeholders, plurals, walk } from './icu.ts';
import { BASE_LOCALE, eachMessage, fileOf, type Problem, type Sources } from './sources.ts';

/** `namespace.key` entries whose Arabic value may be Latin-only (brand names and the like). */
export const LATIN_ALLOWED: readonly string[] = [];

const ARABIC_LETTER = /[ء-يٮ-ۓۺ-ۿ]/u;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Every message parses as ICU; `#` is refused because Flutter gen-l10n needs `{name}`. */
export function checkIcu(sources: Sources): Problem[] {
  const problems: Problem[] = [];
  for (const { file, key, message } of eachMessage(sources)) {
    let elements: ReturnType<typeof parseMessage>;
    try {
      elements = parseMessage(message);
    } catch (err) {
      problems.push({ file, key, message: `invalid ICU message: ${errorText(err)}` });
      continue;
    }
    if ([...walk(elements)].some(isPoundElement)) {
      problems.push({
        file,
        key,
        message: 'use the named argument ({count}) instead of # in a plural',
      });
    }
  }
  return problems;
}

/** Every cardinal plural lists all CLDR categories of its locale (Arabic: six). */
export function checkPlurals(sources: Sources): Problem[] {
  const problems: Problem[] = [];
  for (const { locale, file, key, message } of eachMessage(sources)) {
    const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    let elements: ReturnType<typeof parseMessage>;
    try {
      elements = parseMessage(message);
    } catch {
      continue; // reported by checkIcu
    }
    for (const plural of plurals(elements)) {
      if (plural.pluralType === 'ordinal') continue;
      const missing = required.filter((c) => !(c in plural.options));
      if (missing.length > 0) {
        problems.push({
          file,
          key,
          message: `plural {${plural.value}} lacks ${locale} categories: ${missing.join(' ')}`,
        });
      }
    }
  }
  return problems;
}

/** The base locale's `errors` namespace has exactly one key per error code. */
export function checkErrorCodes(sources: Sources, codes: readonly string[]): Problem[] {
  const errors = sources[BASE_LOCALE]?.['errors'] ?? {};
  const file = fileOf(BASE_LOCALE, 'errors');
  const known = new Set(codes);
  return [
    ...codes
      .filter((code) => !(code in errors))
      .map((code) => ({ file, key: code, message: 'error code has no message' })),
    ...Object.keys(errors)
      .filter((key) => !known.has(key))
      .map((key) => ({ file, key, message: 'no ErrorCode has this key' })),
  ];
}

function placeholderSet(message: string): string | undefined {
  try {
    return [...placeholders(parseMessage(message)).keys()].join(', ');
  } catch {
    return undefined; // reported by checkIcu
  }
}

/** Every locale has the base locale's namespaces and keys, with the same placeholder names. */
export function checkParity(sources: Sources, base: string = BASE_LOCALE): Problem[] {
  const reference = sources[base] ?? {};
  const problems: Problem[] = [];
  for (const [locale, namespaces] of Object.entries(sources)) {
    if (locale === base) continue;
    const names = new Set([...Object.keys(reference), ...Object.keys(namespaces)]);
    for (const namespace of [...names].sort()) {
      const file = fileOf(locale, namespace);
      const want = reference[namespace];
      const have = namespaces[namespace];
      if (want === undefined || have === undefined) {
        const message = want === undefined ? `namespace not in ${base}` : 'namespace missing';
        problems.push({ file, key: '*', message });
        continue;
      }
      for (const key of Object.keys(want)) {
        const theirs = have[key];
        const ours = want[key] ?? '';
        if (theirs === undefined) {
          problems.push({ file, key, message: `missing (present in ${base})` });
          continue;
        }
        const a = placeholderSet(ours);
        const b = placeholderSet(theirs);
        if (a !== undefined && b !== undefined && a !== b) {
          problems.push({ file, key, message: `placeholders {${b}} differ from ${base} {${a}}` });
        }
      }
      for (const key of Object.keys(have).filter((k) => !(k in want))) {
        problems.push({ file, key, message: `not in ${base}` });
      }
    }
  }
  return problems;
}

/** No empty values; Arabic values contain an Arabic letter unless allow-listed. */
export function checkValues(
  sources: Sources,
  allowLatin: readonly string[] = LATIN_ALLOWED,
): Problem[] {
  const allowed = new Set(allowLatin);
  const problems: Problem[] = [];
  for (const { locale, namespace, file, key, message } of eachMessage(sources)) {
    if (message.trim() === '') {
      problems.push({ file, key, message: 'empty message' });
    } else if (
      locale === 'ar' &&
      !ARABIC_LETTER.test(message) &&
      !allowed.has(`${namespace}.${key}`)
    ) {
      problems.push({ file, key, message: 'Arabic message has no Arabic letter (allow-list it?)' });
    }
  }
  return problems;
}
