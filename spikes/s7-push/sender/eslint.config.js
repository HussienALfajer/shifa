import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  // Lint-only exceptions for the slice's locked tests (0.3-S7a); their assertions are unchanged.
  {
    // Planted secrets are split into template parts on purpose, so this file never holds a
    // pattern the key-leak check looks for.
    files: ['test/check-no-secrets.test.ts'],
    rules: { '@typescript-eslint/no-unnecessary-template-expression': 'off' },
  },
  {
    // `${28 * 24 * 3600}s` builds FCM's TTL string from a number.
    files: ['test/payload.test.ts'],
    rules: { '@typescript-eslint/restrict-template-expressions': 'off' },
  },
  {
    // `receiverRef` is read by the fake's callback before the setup returns, so it cannot be
    // a const declared after it.
    files: ['test/send.test.ts'],
    rules: { 'prefer-const': 'off' },
  },
];
