// Finds the places where a file writes Tailwind classes or inline styles, for the rules that
// check them (no-physical-direction, no-hardcoded-design-values). Only class contexts are read,
// so ordinary strings ("press the left arrow") and data objects ({ left, right }) are left alone.
// A class context is followed into a `const` it names, a function it calls for the classes
// (UI SDK's `className={(state) => …}`) and a style object kept in a constant.

/** Calls whose arguments are class lists, object keys included (clsx style). */
const CLASS_CALLS = new Set(['cn', 'clsx', 'classNames', 'cx', 'twMerge', 'twJoin']);
/** Calls whose argument values are class lists but whose object keys are variant names. */
const VARIANT_CALLS = new Set(['cva', 'tv']);
const CLASS_NAMES = new Set(['className', 'class']);
/** How many `const` hops are followed; enough for real code, safe against cycles. */
const MAX_DEPTH = 4;

function calleeName(node) {
  if (node.callee.type === 'Identifier') return node.callee.name;
  if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
    return node.callee.property.name;
  }
  return null;
}

/** The initializer of the `const` that `node` (an Identifier) names, or null. */
function constInit(context, node) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) {
      const def = variable.defs[0];
      if (def?.type === 'Variable' && def.parent?.kind === 'const' && def.node.init) {
        return def.node.init;
      }
      return null;
    }
    scope = scope.upper;
  }
  return null;
}

/** The expressions a function returns: its expression body, or each `return` of its block. */
function returned(fn) {
  if (fn.body.type !== 'BlockStatement') return [fn.body];
  const out = [];
  const walk = (statement) => {
    if (!statement || typeof statement !== 'object') return;
    if (statement.type === 'ReturnStatement') {
      out.push(statement.argument);
      return;
    }
    // Nested functions return for themselves.
    if (/Function/.test(statement.type)) return;
    for (const key of [
      'body',
      'consequent',
      'alternate',
      'block',
      'handler',
      'finalizer',
      'cases',
    ]) {
      const child = statement[key];
      if (Array.isArray(child)) child.forEach(walk);
      else walk(child);
    }
  };
  walk(fn.body);
  return out;
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
 * `onStyle(property, name, value)` for each property of an inline style object (literal, kept
 * in a `const`, spread or returned by a style function), with `value` the literal value (string
 * or number) or undefined when it is computed. Each node is reported once.
 * @param {import('eslint').Rule.RuleContext} context
 * @param {{ onClasses: (node: any, text: string) => void,
 *           onStyle: (property: any, name: string, value: string | number | undefined) => void }} handlers
 */
export function classVisitors(context, { onClasses, onStyle }) {
  const seen = new WeakSet();
  const found = (node, text) => {
    if (seen.has(node)) return;
    seen.add(node);
    onClasses(node, text);
  };

  /**
   * Every string piece of `node` that holds classes: literals, template parts, both branches of
   * a condition, array items, object values and, with `keys`, object keys. A nested call is left
   * to the CallExpression visitor, so nothing is reported twice.
   */
  function collect(node, keys, depth = 0) {
    if (!node || depth > MAX_DEPTH) return;
    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') found(node, node.value);
        return;
      case 'TemplateLiteral':
        for (const quasi of node.quasis) found(quasi, quasi.value.cooked ?? quasi.value.raw);
        for (const expression of node.expressions) collect(expression, keys, depth);
        return;
      case 'ConditionalExpression':
        collect(node.consequent, keys, depth);
        collect(node.alternate, keys, depth);
        return;
      case 'LogicalExpression':
        collect(node.right, keys, depth);
        if (node.operator !== '&&') collect(node.left, keys, depth);
        return;
      case 'ArrayExpression':
        for (const element of node.elements) collect(element, keys, depth);
        return;
      case 'ObjectExpression':
        for (const property of node.properties) {
          if (property.type !== 'Property') continue;
          if (keys && !property.computed) {
            if (property.key.type === 'Literal') collect(property.key, keys, depth);
            else if (property.key.type === 'Identifier') found(property.key, property.key.name);
          }
          if (!keys) collect(property.value, keys, depth);
        }
        return;
      case 'Identifier':
        collect(constInit(context, node), keys, depth + 1);
        return;
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        for (const expression of returned(node)) collect(expression, keys, depth + 1);
        return;
      case 'JSXExpressionContainer':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
        collect(node.expression, keys, depth);
        return;
      default:
    }
  }

  /** Every property of a style object, through constants, spreads and style functions. */
  function styles(node, depth = 0) {
    if (!node || depth > MAX_DEPTH) return;
    switch (node.type) {
      case 'ObjectExpression':
        for (const property of node.properties) {
          if (property.type === 'SpreadElement') {
            styles(property.argument, depth + 1);
            continue;
          }
          if (property.type !== 'Property' || seen.has(property)) continue;
          const name = keyName(property);
          if (name === null) continue;
          seen.add(property);
          const value = property.value;
          const literal =
            value.type === 'Literal' && ['string', 'number'].includes(typeof value.value)
              ? value.value
              : value.type === 'TemplateLiteral' && value.expressions.length === 0
                ? value.quasis[0]?.value.cooked
                : undefined;
          onStyle(property, name, literal ?? undefined);
        }
        return;
      case 'Identifier':
        styles(constInit(context, node), depth + 1);
        return;
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        for (const expression of returned(node)) styles(expression, depth + 1);
        return;
      case 'ConditionalExpression':
        styles(node.consequent, depth);
        styles(node.alternate, depth);
        return;
      case 'LogicalExpression':
        styles(node.right, depth);
        return;
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
        styles(node.expression, depth);
        return;
      default:
    }
  }

  return {
    JSXAttribute(node) {
      if (node.name.type !== 'JSXIdentifier') return;
      if (CLASS_NAMES.has(node.name.name)) {
        collect(node.value, true);
        return;
      }
      if (node.name.name === 'style' && node.value?.type === 'JSXExpressionContainer') {
        styles(node.value.expression);
      }
    },
    // `className` written as an object property: story args, props objects spread into JSX.
    Property(node) {
      const name = keyName(node);
      if (name !== null && CLASS_NAMES.has(name)) collect(node.value, true);
    },
    CallExpression(node) {
      const name = calleeName(node);
      if (name === null) return;
      const keys = CLASS_CALLS.has(name);
      if (!keys && !VARIANT_CALLS.has(name)) return;
      for (const argument of node.arguments) collect(argument, keys);
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
