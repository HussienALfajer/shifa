// Slice A-01-06 (backlog 0.4-03): app code under apps/ never draws its own button. `<button>`
// and `role="button"` on another element are refused there; Button from @shifa/ui carries the
// focus ring, the pressed state, the disabled semantics and the density. Elsewhere (packages/ui
// builds Button) the rule is silent.
import { isAbsolute, relative, resolve } from 'node:path';

/** The string of a JSX attribute value: "x", {'x'} or {`x`}; else null. */
function attributeText(value) {
  if (!value) return null;
  if (value.type === 'Literal' && typeof value.value === 'string') return value.value;
  if (value.type !== 'JSXExpressionContainer') return null;
  const expression = value.expression;
  if (expression.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value;
  }
  if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
    return expression.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

/** True when `filename` lies under `root` (another drive gives an absolute relative path). */
const inside = (root, filename) => {
  const path = relative(resolve(root), resolve(filename));
  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
};

/** @type {import('eslint').Rule.RuleModule} */
export const noRawButtonRule = {
  meta: {
    type: 'problem',
    docs: { description: 'App code uses Button from @shifa/ui, never a raw button.' },
    schema: [
      {
        type: 'object',
        properties: { appsRoot: { type: 'string' } },
        required: ['appsRoot'],
        additionalProperties: false,
      },
    ],
    messages: {
      rawButton: 'Use Button (or IconButton) from @shifa/ui instead of <button>.',
      roleButton: 'Use Button from @shifa/ui instead of role="button" on another element.',
    },
  },
  create(context) {
    const { appsRoot } = context.options[0];
    if (!inside(appsRoot, context.filename)) return {};
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'button') {
          context.report({ node, messageId: 'rawButton' });
          return;
        }
        for (const attribute of node.attributes) {
          if (
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'role' &&
            attributeText(attribute.value)?.trim() === 'button'
          ) {
            context.report({ node: attribute, messageId: 'roleButton' });
          }
        }
      },
    };
  },
};
