// Lints the repository's own JavaScript (scripts/, tooling/). Workspace packages lint themselves
// through Turborepo with the shared type-aware config.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig(
  { ignores: ['apps/**', 'packages/**', 'node_modules/**', '.turbo/**', '.verify/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'always'],
    },
  },
);
