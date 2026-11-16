import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The gateway's spike state lives in its own database outside the product schema, reached
    // without withTenant() by design (slice 0.3-S4a, "Layout"); the audit, upload and edge tests
    // read it back.
    files: [
      'src/audit.ts',
      'src/context.ts',
      'src/main.ts',
      'src/uploads.ts',
      'test/audit.test.ts',
      'test/edge-routes.test.ts',
      'test/uploads.test.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
];
