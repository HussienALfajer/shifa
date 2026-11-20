// Spec 0.4 criterion 6: colours, spacing and fonts come from the tokens. In class lists that
// means no arbitrary value (`p-[13px]`, `bg-[#fff]`) and no spacing step the token theme does
// not offer (`p-14`, `gap-2.5`); in inline styles no literal colour, length or font family.
// A reference to a token custom property (`h-(--shifa-…)`, `var(--shifa-…)`) is allowed.
import { classVisitors, splitClasses } from './class-strings.js';

/** Utilities whose value is a spacing step. */
const SPACING_UTILITY =
  // Longer names first: `gap-x-14` must not stop at `gap` with the value `x-14`.
  /^(?:p|px|py|ps|pe|pt|pb|pbs|pbe|m|mx|my|ms|me|mt|mb|mbs|mbe|gap-x|gap-y|gap|space-x|space-y|inset-x|inset-y|inset-s|inset-e|inset-bs|inset-be|inset|start|end|top|bottom|translate-x|translate-y|scroll-mbs|scroll-mbe|scroll-pbs|scroll-pbe|scroll-m[xyseb]?|scroll-p[xyseb]?|indent|w|h|size|min-w|min-h|max-w|max-h|inline|min-inline|max-inline|block|min-block|max-block|basis)-(.+)$/;
/** Sizing utilities and the 1 px press nudge (`translate-y-px`), where a 1px hairline is fine. */
const SIZING =
  /^(?:w|h|size|min-w|min-h|max-w|max-h|inline|min-inline|max-inline|block|min-block|max-block|basis|translate-x|translate-y)-/;
const NUMERIC = /^\d+(?:\.\d+)?$/;
const TOKEN_REFERENCE = /^(?:\(--shifa-[\w-]+\)|\[var\(--shifa-[\w-]+\)\])$/;

const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const LENGTH = /(?:^|[\s(,])-?\d*\.?\d+(?:px|rem|em|pt|vh|vw|ch|ex)\b/;
const COLOUR_PROPERTY =
  /(?:^|-)(?:color|background|fill|stroke|shadow)$|^(?:background|border|outline)(?:-|$)/;
const LENGTH_PROPERTY =
  /^(?:margin|padding|gap|row-gap|column-gap|inset|top|bottom|width|height|min-width|min-height|max-width|max-height|font-size|line-height|letter-spacing|border-radius|border-width|outline-offset|translate)(?:-.+)?$/;

const kebab = (name) => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

/**
 * Why a class is not a token value, or null. `spacing` holds the spacing steps of the theme.
 * @param {string} cls
 * @param {Set<string>} spacing
 * @returns {{ messageId: 'arbitraryValue' | 'spacingStep', value: string } | null}
 */
export function hardcodedClass(cls, spacing) {
  const [{ base } = { base: '' }] = splitClasses(cls);
  // An arbitrary property ([margin:3px]) or value (p-[13px], bg-[#fff], font-['Inter']).
  if (/^\[.+\]$/.test(base)) return { messageId: 'arbitraryValue', value: base };
  const arbitrary = /-(\[.+\]|\(.+\))$/.exec(base);
  if (arbitrary) {
    return TOKEN_REFERENCE.test(arbitrary[1] ?? '')
      ? null
      : { messageId: 'arbitraryValue', value: base };
  }
  const step = SPACING_UTILITY.exec(base);
  if (step) {
    const value = step[1] ?? '';
    if (NUMERIC.test(value) && !spacing.has(value))
      return { messageId: 'spacingStep', value: base };
    if (value === 'px' && !SIZING.test(base)) return { messageId: 'spacingStep', value: base };
  }
  return null;
}

/**
 * Why an inline style value is hard-coded, or null.
 * @param {string} name
 * @param {string | number | undefined} value
 * @returns {'hardcodedColor' | 'hardcodedFont' | 'hardcodedLength' | null}
 */
export function hardcodedStyle(name, value) {
  if (value === undefined) return null;
  const property = kebab(name);
  const text = String(value);
  if (/var\(--shifa-/.test(text) && !COLOUR.test(text.replace(/var\([^)]*\)/g, ''))) return null;
  if (typeof value === 'string' && COLOUR.test(text)) return 'hardcodedColor';
  if (property === 'font-family') return 'hardcodedFont';
  if (
    COLOUR_PROPERTY.test(property) &&
    /^[a-z]+$/i.test(text) &&
    !/^(?:inherit|transparent|currentcolor|none|initial|unset)$/i.test(text)
  ) {
    return 'hardcodedColor';
  }
  if (LENGTH_PROPERTY.test(property)) {
    if (typeof value === 'number') return value === 0 ? null : 'hardcodedLength';
    if (LENGTH.test(text)) return 'hardcodedLength';
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noHardcodedDesignValuesRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Colours, spacing and fonts come from the design tokens.' },
    schema: [
      {
        type: 'object',
        properties: { spacing: { type: 'array', items: { type: 'string' } } },
        required: ['spacing'],
        additionalProperties: false,
      },
    ],
    messages: {
      arbitraryValue:
        "'{{value}}' is an arbitrary value; use a token utility or a token reference such as h-(--shifa-…).",
      spacingStep: "'{{value}}' is not a step of the spacing tokens ({{steps}}).",
      hardcodedColor: 'A literal colour; use a semantic colour token (var(--shifa-color-…)).',
      hardcodedFont: 'A literal font family; use var(--shifa-font-family-…) or font-sans.',
      hardcodedLength: 'A literal length; use a spacing, size or type token (var(--shifa-…)).',
    },
  },
  create(context) {
    const spacing = new Set(context.options[0]?.spacing ?? []);
    const steps = [...spacing].join(', ');
    return classVisitors(context, {
      onClasses(node, text) {
        for (const { raw } of splitClasses(text)) {
          const problem = hardcodedClass(raw, spacing);
          if (problem) {
            context.report({ node, messageId: problem.messageId, data: { value: raw, steps } });
          }
        }
      },
      onStyle(property, name, value) {
        const messageId = hardcodedStyle(name, value);
        if (messageId) context.report({ node: property, messageId });
      },
    });
  },
};
