import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The messaging suites' PostgreSQL lives outside the product schema and is reached without
    // withTenant() by design (slice 0.3-S5a, "Spike state").
    files: ['src/postgres.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
