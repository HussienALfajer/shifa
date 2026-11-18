import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The locked adapter test declares its case table with a `type` alias (style only).
    files: ['test/providers.test.ts'],
    rules: { '@typescript-eslint/consistent-type-definitions': 'off' },
  },
];
