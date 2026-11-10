// ICU MessageFormat helpers over @formatjs/icu-messageformat-parser: parsing with the options both
// consumers accept, walking nested elements and collecting placeholders with their types.
import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTimeElement,
  type MessageFormatElement,
  type PluralElement,
  parse,
} from '@formatjs/icu-messageformat-parser';

/** Flutter gen-l10n placeholder types; a stronger one wins when an argument is used twice. */
export type PlaceholderType = 'String' | 'num' | 'DateTime';
const STRENGTH: Record<PlaceholderType, number> = { String: 0, DateTime: 1, num: 2 };

/** Tags are plain text: neither Flutter gen-l10n nor our i18next setup renders them. */
export function parseMessage(message: string): MessageFormatElement[] {
  return parse(message, { ignoreTag: true, requiresOtherClause: true });
}

/** Every element, depth first, including those inside plural and select options. */
export function* walk(elements: MessageFormatElement[]): Generator<MessageFormatElement> {
  for (const el of elements) {
    yield el;
    if (isPluralElement(el) || isSelectElement(el)) {
      for (const option of Object.values(el.options)) yield* walk(option.value);
    }
  }
}

export function plurals(elements: MessageFormatElement[]): PluralElement[] {
  return [...walk(elements)].filter(isPluralElement);
}

function typeOf(el: MessageFormatElement): PlaceholderType | undefined {
  if (isPluralElement(el) || isNumberElement(el)) return 'num';
  if (isDateElement(el) || isTimeElement(el)) return 'DateTime';
  if (isSelectElement(el) || isArgumentElement(el)) return 'String';
  return undefined;
}

/** Placeholder name → type, sorted by name. */
export function placeholders(elements: MessageFormatElement[]): Map<string, PlaceholderType> {
  const found = new Map<string, PlaceholderType>();
  for (const el of walk(elements)) {
    const type = typeOf(el);
    if (type === undefined || !('value' in el)) continue;
    const previous = found.get(el.value);
    if (previous === undefined || STRENGTH[type] > STRENGTH[previous]) found.set(el.value, type);
  }
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
