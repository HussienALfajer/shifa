// ADR-0003 module boundaries for a package with src/modules/<context>/ (the API).
// The pure check is shared with apps/api/test/architecture/module-imports.test.ts, which runs
// it on the real tree and cannot be silenced by a disable comment.
import { dirname, relative, resolve } from 'node:path';

const INDEX = /^index(?:\.[cm]?[jt]sx?)?$/;
const LAYERS = new Set(['platform', 'access']);

/** Absolute path a relative or `@/` specifier points at; null for packages. */
function targetPath(srcRoot, file, specifier) {
  if (specifier.startsWith('@/')) return resolve(srcRoot, specifier.slice(2));
  if (specifier === '.' || specifier === '..' || /^\.\.?\//.test(specifier)) {
    return resolve(dirname(file), specifier);
  }
  return null;
}

/** Path segments below `srcRoot`, or null when `path` lies outside it. */
function segments(srcRoot, path) {
  const rel = relative(srcRoot, path);
  if (rel === '') return [];
  const parts = rel.split(/[\\/]/);
  return parts[0] === '..' || /^[a-zA-Z]:$/.test(parts[0] ?? '') ? null : parts;
}

/**
 * Why importing `specifier` from `file` breaks the boundary, or null when it is allowed.
 * - a file in modules/<a>/ may reach modules/<b>/ (b ≠ a) only through modules/<b>/index.ts;
 * - a file in platform/ or access/ may not reach modules/ at all.
 * @param {string} srcRoot absolute path of the package's src/
 * @param {string} file absolute path of the importing file
 * @param {string} specifier the import string as written
 * @returns {'deepImport' | 'layerImport' | null}
 */
export function boundaryViolation(srcRoot, file, specifier) {
  const to = targetPath(srcRoot, file, specifier);
  if (to === null) return null;
  const from = segments(srcRoot, file);
  const target = segments(srcRoot, to);
  if (from === null || target === null || target[0] !== 'modules') return null;
  if (LAYERS.has(from[0] ?? '')) return 'layerImport';
  if (from[0] !== 'modules' || target[1] === from[1]) return null;
  const viaIndex = target.length === 2 || (target.length === 3 && INDEX.test(target[2] ?? ''));
  return viaIndex ? null : 'deepImport';
}

/** @type {import('eslint').Rule.RuleModule} */
export const moduleBoundariesRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Modules import each other only through index.ts (ADR-0003).' },
    schema: [
      {
        type: 'object',
        properties: { srcRoot: { type: 'string' } },
        required: ['srcRoot'],
        additionalProperties: false,
      },
    ],
    messages: {
      deepImport: "Import another module only through its index.ts: '{{specifier}}' (ADR-0003).",
      layerImport:
        "src/platform and src/access must not import from src/modules: '{{specifier}}' (ADR-0003).",
    },
  },
  create(context) {
    const { srcRoot } = context.options[0];
    const file = context.filename;
    /** @param {any} literal a string Literal node, or anything else (ignored) */
    function check(literal) {
      if (literal?.type !== 'Literal' || typeof literal.value !== 'string') return;
      const messageId = boundaryViolation(srcRoot, file, literal.value);
      if (messageId)
        context.report({ node: literal, messageId, data: { specifier: literal.value } });
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      // TypeScript-only forms: import x = require('…') and typeof import('…').
      TSImportEqualsDeclaration: (node) => check(node.moduleReference?.expression),
      TSImportType: (node) => check(node.argument?.literal ?? node.source),
    };
  },
};

/** ESLint plugin `shifa`. */
export const shifaPlugin = { rules: { 'module-boundaries': moduleBoundariesRule } };
