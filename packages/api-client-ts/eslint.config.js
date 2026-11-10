import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Type-level tests declare values only to inspect `typeof` them. tsc's noUnusedLocals still
    // reports a value that is never used at all.
    files: ['test/**/*.test-d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
];
