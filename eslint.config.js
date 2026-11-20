// Lints the repository's own JavaScript (scripts/, tooling/). Workspace packages lint themselves
// through Turborepo with the shared type-aware config.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig(
  // spikes/ packages lint themselves through Turborepo like apps/ and packages/; without this
  // ignore, ESLint's per-directory config lookup ran their type-aware configs a second time here.
  {
    ignores: [
      'apps/**',
      'packages/**',
      'spikes/**',
      // Design-direction prototypes exported from the design project (slice 0.4-02).
      'design/directions/**',
      'node_modules/**',
      '.turbo/**',
      '.verify/**',
      // Generated, git-ignored: test data and image build contexts (0.3-S4 spike).
      '.cache/**',
      '.claude/worktrees/**',
    ],
  },
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
