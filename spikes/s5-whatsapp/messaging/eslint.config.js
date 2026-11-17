import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The spike's state lives in its own database outside the product schema, reached without
    // withTenant() by design (slice 0.3-S5a, "Spike state").
    files: ['src/db.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The locked ack test collects `fake?.ack(...)` results (Promise | undefined) for one
    // Promise.all; undefined entries resolve at once, which is what the test wants.
    files: ['test/acks.test.ts'],
    rules: { '@typescript-eslint/await-thenable': 'off' },
  },
];
