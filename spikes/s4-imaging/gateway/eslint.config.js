import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The gateway's spike state lives in its own database outside the product schema, reached
    // without withTenant() by design (slice 0.3-S4a, "Layout"); the audit test reads it back.
    files: ['src/audit.ts', 'test/audit.test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
