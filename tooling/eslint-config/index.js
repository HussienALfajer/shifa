// Shared ESLint flat config for every TypeScript package.
// Type-aware rules catch what formatting and tsc cannot (unawaited promises, unsafe any).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Hand-written files above this length must be split. */
export const MAX_LINES = 400;

const DB_MESSAGE = 'Use @shifa/db (withTenant) instead of a raw database connection (ADR-0005).';
const DRIVERS = [
  'pg',
  'pg-pool',
  'pg-native',
  'postgres',
  '@neondatabase/serverless',
  '@electric-sql/pglite',
];
const DRIZZLE_DRIVERS = [
  'node-postgres',
  'postgres-js',
  'pg-proxy',
  'pglite',
  'neon-serverless',
  'neon-http',
  'vercel-postgres',
  'xata-http',
  'aws-data-api',
];
const TEST_FILES = ['test/**', 'tests/**', 'e2e/**', '**/*.test.*', '**/*.spec.*'];

/**
 * Harness entry points never allowed in production code. Package scripts (e.g. the API boot
 * check) may start the test container but get no raw owner/app handles.
 */
const BLOCKED_TEST_MODULES = {
  production: ['@shifa/db/testing', '@shifa/db/harness'],
  scripts: ['@shifa/db/testing'],
  tests: [],
};
const SCOPE_FILES = {
  production: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
  scripts: ['scripts/**'],
  tests: TEST_FILES,
};

// For no-restricted-syntax: the same modules loaded with import() or require(). esquery regexes
// cannot contain "/", so / stands for it.
const S = String.raw`/`;
const RAW_DB_MODULE = new RegExp(
  [
    `^(${DRIVERS.join('|').replaceAll('/', S)})(${S}|$)`,
    `^drizzle-orm${S}(${DRIZZLE_DRIVERS.join('|')}|pg-core${S})`,
  ].join('|'),
).source;

/**
 * ADR-0005: database access goes through `withTenant()` in @shifa/db. Raw drivers and Drizzle
 * session/transaction classes are blocked outside `allowRawDb`; schema builders stay allowed.
 * `@shifa/db/testing` (raw owner/app handles) is allowed in test files only; `@shifa/db/harness`
 * (the test container) in test files and package scripts.
 * @param {string[]} allowRawDb globs (relative to the package) that may use them
 * @param {'production' | 'scripts' | 'tests'} scope which files this block covers
 */
function dbImportRestrictions(allowRawDb, scope) {
  const message = DB_MESSAGE;
  return {
    files: SCOPE_FILES[scope],
    ignores: allowRawDb,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...DRIVERS.map((name) => ({ name, message })),
            {
              name: 'drizzle-orm/pg-core',
              importNames: ['PgDatabase', 'PgAsyncDatabase', 'PgSession', 'PgTransaction'],
              message,
            },
            ...BLOCKED_TEST_MODULES[scope].map((name) => ({
              name,
              message: `${name} is for tests only.`,
            })),
          ],
          patterns: [
            { group: DRIVERS.map((d) => `${d}/*`), message },
            {
              group: DRIZZLE_DRIVERS.flatMap((d) => [`drizzle-orm/${d}`, `drizzle-orm/${d}/*`]),
              message,
            },
            { group: ['drizzle-orm/pg-core/*'], message },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `ImportExpression[source.value=/${RAW_DB_MODULE}/]`, message },
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=/${RAW_DB_MODULE}/]`,
          message,
        },
        {
          // createRequire(import.meta.url)('pg')
          selector: `CallExpression[callee.type='CallExpression'][arguments.0.value=/${RAW_DB_MODULE}/]`,
          message,
        },
        // import('@shifa/db/testing') and require() of it, where a static import is refused.
        ...BLOCKED_TEST_MODULES[scope].flatMap((name) => [
          {
            selector: `ImportExpression[source.value='${name}']`,
            message: `${name} is for tests only.`,
          },
          {
            selector: `CallExpression[arguments.0.value='${name}']`,
            message: `${name} is for tests only.`,
          },
        ]),
      ],
    },
  };
}

/**
 * @param {{ tsconfigRootDir: string, allowRawDb?: string[] }} options
 *   allowRawDb: only @shifa/db passes this (its src/ and test-harness/).
 */
export function createConfig({ tsconfigRootDir, allowRawDb = [] }) {
  return defineConfig(
    { ignores: ['dist/**', 'coverage/**', '**/*.generated.*', '**/generated/**'] },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        'max-lines': ['error', { max: MAX_LINES, skipBlankLines: true, skipComments: true }],
        'no-console': 'error',
        eqeqeq: ['error', 'always'],
      },
    },
    // Later blocks win for files they share (a test under scripts/ is a test).
    dbImportRestrictions(allowRawDb, 'production'),
    dbImportRestrictions(allowRawDb, 'scripts'),
    dbImportRestrictions(allowRawDb, 'tests'),
    {
      files: ['**/*.js', '**/*.mjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}
