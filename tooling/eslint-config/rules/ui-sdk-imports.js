// ADR-0039: only packages/ui imports the UI library (UI SDK, or Base UI as its fallback), so
// screens use our components and the library underneath can change; and nothing imports the
// UI SDK agent bridge, packages/ui included.
import { relative, resolve } from 'node:path';

const UI_LIBRARY = /^@(?:ui-sdk|base-ui|base-ui-components)(?:\/|$)/;
const AGENT_BRIDGE = /^@ui-sdk\/(?:agent(?:\/|$)|[^/]+\/agent(?:\/|$))/;

/** True for `@ui-sdk/*`, `@base-ui/*` and `@base-ui-components/*` specifiers. */
export const isUiLibrary = (specifier) => UI_LIBRARY.test(specifier);

/** True for the agent bridge: `@ui-sdk/<package>/agent` (and below) or `@ui-sdk/agent`. */
export const isAgentBridge = (specifier) => AGENT_BRIDGE.test(specifier);

/** The string of a Literal or an expression-free template literal, else null. */
function text(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

/** Visitors that pass each module specifier of the file to `check(node, specifier)`. */
function importVisitors(check) {
  const visit = (node) => {
    const specifier = text(node);
    if (specifier !== null) check(node, specifier);
  };
  return {
    ImportDeclaration: (node) => visit(node.source),
    ExportNamedDeclaration: (node) => visit(node.source),
    ExportAllDeclaration: (node) => visit(node.source),
    ImportExpression: (node) => visit(node.source),
    TSImportEqualsDeclaration: (node) => visit(node.moduleReference?.expression),
    TSImportType: (node) => visit(node.argument?.literal ?? node.source),
    CallExpression(node) {
      const callee = node.callee;
      const isRequire =
        (callee.type === 'Identifier' && callee.name === 'require') ||
        (callee.type === 'MemberExpression' && callee.property.name === 'resolve');
      if (isRequire || callee.type === 'CallExpression') visit(node.arguments[0]);
    },
  };
}

/** @type {import('eslint').Rule.RuleModule} */
export const uiSdkOnlyInUiRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Only packages/ui imports @ui-sdk/* or Base UI (ADR-0039).' },
    schema: [
      {
        type: 'object',
        properties: { uiRoot: { type: 'string' } },
        required: ['uiRoot'],
        additionalProperties: false,
      },
    ],
    messages: {
      outsideUi:
        "'{{specifier}}' may be imported in packages/ui only; use the @shifa/ui component (ADR-0039).",
    },
  },
  create(context) {
    const rel = relative(resolve(context.options[0].uiRoot), resolve(context.filename));
    const insideUi = rel !== '' && !rel.startsWith('..') && !/^[a-zA-Z]:/.test(rel);
    if (insideUi) return {};
    return importVisitors((node, specifier) => {
      if (isUiLibrary(specifier))
        context.report({ node, messageId: 'outsideUi', data: { specifier } });
    });
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export const noUiSdkAgentRule = {
  meta: {
    type: 'problem',
    docs: { description: 'The UI SDK agent bridge is never imported (ADR-0039).' },
    schema: [],
    messages: {
      agentBridge:
        "'{{specifier}}' is the UI SDK agent bridge; enabling it needs its own ADR with a security review (ADR-0039).",
    },
  },
  create(context) {
    return importVisitors((node, specifier) => {
      if (isAgentBridge(specifier))
        context.report({ node, messageId: 'agentBridge', data: { specifier } });
    });
  },
};
