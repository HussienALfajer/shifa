// Finds the places where a file writes Tailwind classes or inline styles, for the rules that
// check them (no-physical-direction, no-hardcoded-design-values). Only class contexts are read,
// so ordinary strings ("press the left arrow") and data objects ({ left, right }) are left alone.

/** Calls whose arguments are class lists, object keys included (clsx style). */
const CLASS_CALLS = new Set(['cn', 'clsx', 'classNames', 'cx', 'twMerge', 'twJoin']);
/** Calls whose argument values are class lists but whose object keys are variant names. */
const VARIANT_CALLS = new Set(['cva', 'tv']);
const CLASS_ATTRIBUTES = new Set(['className', 'class']);

function calleeName(node) {
  if (node.callee.type === 'Identifier') return node.callee.name;
  if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
    return node.callee.property.name;
  }
  return null;
}

/**
 * Every string piece of `node` that holds classes: literals, template parts, both branches of a
 * condition, array items, object values and, with `keys`, object keys. A nested call is left to
 * the CallExpression visitor, so nothing is reported twice.
 * @param {any} node
 * @param {boolean} keys
 * @param {(node: any, text: string) => void} found
 */
function collect(node, keys, found) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') found(node, node.value);
      return;
    case 'TemplateLiteral':
      for (const quasi of node.quasis) found(quasi, quasi.value.cooked ?? quasi.value.raw);
      for (const expression of node.expressions) collect(expression, keys, found);
      return;
    case 'ConditionalExpression':
      collect(node.consequent, keys, found);
      collect(node.alternate, keys, found);
      return;
    case 'LogicalExpression':
      collect(node.right, keys, found);
      if (node.operator !== '&&') collect(node.left, keys, found);
      return;
    case 'ArrayExpression':
      for (const element of node.elements) collect(element, keys, found);
      return;
    case 'ObjectExpression':
      for (const property of node.properties) {
        if (property.type !== 'Property') continue;
        if (keys && !property.computed) {
          if (property.key.type === 'Literal') collect(property.key, keys, found);
          else if (property.key.type === 'Identifier') found(property.key, property.key.name);
        }
        if (!keys) collect(property.value, keys, found);
      }
      return;
    case 'JSXExpressionContainer':
      collect(node.expression, keys, found);
      return;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      collect(node.expression, keys, found);
      return;
    default:
  }
}

/** The key of an object property as written (`marginLeft`, `'margin-left'`), or null. */
function keyName(property) {
  if (property.computed) return null;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return null;
}

/**
 * ESLint visitors that call `onClasses(node, text)` for each class string and
 * `onStyle(property, name, value)` for each property of an inline `style={{ … }}` object, with
 * `value` the literal value (string or number) or undefined when it is computed.
 * @param {{ onClasses: (node: any, text: string) => void,
 *           onStyle: (property: any, name: string, value: string | number | undefined) => void }} handlers
 */
export function classVisitors({ onClasses, onStyle }) {
  return {
    JSXAttribute(node) {
      if (node.name.type !== 'JSXIdentifier') return;
      if (CLASS_ATTRIBUTES.has(node.name.name)) {
        collect(node.value, true, onClasses);
        return;
      }
      if (node.name.name !== 'style' || node.value?.type !== 'JSXExpressionContainer') return;
      const object = node.value.expression;
      if (object.type !== 'ObjectExpression') return;
      for (const property of object.properties) {
        if (property.type !== 'Property') continue;
        const name = keyName(property);
        if (name === null) continue;
        const value = property.value;
        const literal =
          value.type === 'Literal' && ['string', 'number'].includes(typeof value.value)
            ? value.value
            : value.type === 'TemplateLiteral' && value.expressions.length === 0
              ? value.quasis[0]?.value.cooked
              : undefined;
        onStyle(property, name, literal ?? undefined);
      }
    },
    CallExpression(node) {
      const name = calleeName(node);
      if (name === null) return;
      const keys = CLASS_CALLS.has(name);
      if (!keys && !VARIANT_CALLS.has(name)) return;
      for (const argument of node.arguments) collect(argument, keys, onClasses);
    },
  };
}

/**
 * The classes of a class string, with variants (`md:hover:`), the important mark and a leading
 * minus removed: `md:!-ml-2` → { base: 'ml-2', raw: 'md:!-ml-2', negative: true }.
 * @param {string} text
 */
export function splitClasses(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      // The last ':' outside brackets ends the variants; arbitrary values may hold ':'.
      let depth = 0;
      let cut = 0;
      for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (ch === '[' || ch === '(') depth += 1;
        else if (ch === ']' || ch === ')') depth -= 1;
        else if (ch === ':' && depth === 0) cut = i + 1;
      }
      let base = raw.slice(cut).replace(/^!|!$/g, '');
      const negative = base.startsWith('-');
      if (negative) base = base.slice(1);
      return { raw, base, negative };
    });
}
