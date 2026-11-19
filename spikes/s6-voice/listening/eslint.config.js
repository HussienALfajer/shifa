import { createConfig } from '@shifa/eslint-config';

export default [
  { ignores: ['playwright-report/**', 'test-results/**', 'test-set/**'] },
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The locked rating spec counts pair clicks with an index loop (style only).
    files: ['e2e/rating.spec.ts'],
    rules: { '@typescript-eslint/prefer-for-of': 'off' },
  },
];
