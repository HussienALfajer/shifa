// Spec 0.4 criterion 6: layouts are drawn RTL first, so a class or an inline style names a
// logical side (start/end, inline/block), never left or right.
import { classVisitors, splitClasses } from './class-strings.js';

/** Physical Tailwind utilities, each with the logical one to use instead. */
const PHYSICAL_CLASSES = [
  [/^(m|p|scroll-m|scroll-p)l(-|$)/, (m) => `${m[1]}s-`],
  [/^(m|p|scroll-m|scroll-p)r(-|$)/, (m) => `${m[1]}e-`],
  [/^left(-|$)/, () => 'start-'],
  [/^right(-|$)/, () => 'end-'],
  [/^text-(left|right)$/, (m) => (m[1] === 'left' ? 'text-start' : 'text-end')],
  [/^rounded-(l|r)(-|$)/, (m) => (m[1] === 'l' ? 'rounded-s' : 'rounded-e')],
  [/^rounded-(tl|tr|bl|br)(-|$)/, () => 'rounded-ss / -se / -es / -ee'],
  [/^border-(l|r)(-|$)/, (m) => (m[1] === 'l' ? 'border-s' : 'border-e')],
  [/^(float|clear)-(left|right)$/, (m) => `${m[1]}-${m[2] === 'left' ? 'start' : 'end'}`],
  [/^(origin|bg|object)-(top-|bottom-)?(left|right)(-|$)/, () => 'a direction-aware position'],
  [/^space-x-reverse$/, () => 'gap with a logical flex direction'],
];

/**
 * The logical replacement of a physical utility (variants allowed), or null.
 * @param {string} cls
 */
export function physicalClass(cls) {
  const [{ base } = { base: '' }] = splitClasses(cls);
  for (const [pattern, logical] of PHYSICAL_CLASSES) {
    const match = pattern.exec(base);
    if (match) return logical(match);
  }
  return null;
}

/** camelCase and kebab-case CSS property names that name a physical side. */
const PHYSICAL_PROPERTY =
  /^(left|right|(margin|padding|scroll-margin|scroll-padding|border)-(left|right)(-.+)?|border-(top|bottom)-(left|right)-radius)$/;

const kebab = (name) => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

/**
 * Why a CSS property and value name a physical side, or null.
 * @param {string} name `marginLeft` or `margin-left`
 * @param {string | number | undefined} value
 */
export function physicalCssProperty(name, value) {
  const property = kebab(name);
  if (PHYSICAL_PROPERTY.test(property)) return `${property} names a physical side`;
  if (['text-align', 'float', 'clear'].includes(property) && ['left', 'right'].includes(value)) {
    return `${property}: ${value} names a physical side`;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noPhysicalDirectionRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Use logical sides (start/end, inline/block), never left/right.' },
    schema: [],
    messages: {
      physicalClass: "'{{cls}}' names a physical side; use {{logical}} (layouts are RTL first).",
      physicalProperty: '{{reason}}; use the logical property (inline-start/end).',
    },
  },
  create(context) {
    return classVisitors(context, {
      onClasses(node, text) {
        for (const { raw } of splitClasses(text)) {
          const logical = physicalClass(raw);
          if (logical)
            context.report({ node, messageId: 'physicalClass', data: { cls: raw, logical } });
        }
      },
      onStyle(property, name, value) {
        const reason = physicalCssProperty(name, value);
        if (reason)
          context.report({ node: property, messageId: 'physicalProperty', data: { reason } });
      },
    });
  },
};
