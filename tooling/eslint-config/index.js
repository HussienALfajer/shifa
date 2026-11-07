// Shared ESLint flat config for every TypeScript package.
// Type-aware rules catch what formatting and tsc cannot (unawaited promises, unsafe any).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Hand-written files above this length must be split. */
export const MAX_LINES = 400;

/**
 * @param {{ tsconfigRootDir: string }} options
 */
export function createConfig({ tsconfigRootDir }) {
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
    {
      files: ['**/*.js', '**/*.mjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}
