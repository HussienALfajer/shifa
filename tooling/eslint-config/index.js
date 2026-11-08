// Shared ESLint flat config for every TypeScript package.
// Type-aware rules catch what formatting and tsc cannot (unawaited promises, unsafe any).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Hand-written files above this length must be split. */
export const MAX_LINES = 400;

/**
 * ADR-0005: database access goes through `withTenant()` in @shifa/db. Raw pools, drivers and
 * Drizzle session/transaction classes are blocked everywhere else; schema builders stay allowed.
 * @param {string[]} allowRawDb globs (relative to the package) that may use them
 */
function dbImportRestrictions(allowRawDb) {
  const message = 'Use @shifa/db (withTenant) instead of a raw database connection (ADR-0005).';
  return {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    ignores: allowRawDb,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message },
            { name: 'pg-pool', message },
            { name: 'postgres', message },
            {
              name: 'drizzle-orm/pg-core',
              importNames: ['PgDatabase', 'PgAsyncDatabase', 'PgSession', 'PgTransaction'],
              message,
            },
          ],
          patterns: [
            {
              group: ['pg/*', 'drizzle-orm/node-postgres', 'drizzle-orm/node-postgres/*'],
              message,
            },
            { group: ['drizzle-orm/postgres-js', 'drizzle-orm/postgres-js/*'], message },
            { group: ['drizzle-orm/pg-core/*'], message },
          ],
        },
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
    dbImportRestrictions(allowRawDb),
    {
      files: ['**/*.js', '**/*.mjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}
