import { createConfig } from '@shifa/eslint-config';

export default [
  { ignores: ['playwright-report/**', 'test-results/**', 'public/**'] },
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The in-page log also writes each `played` acknowledgement to the console (slice plan).
    files: ['src/log.ts'],
    rules: { 'no-console': 'off' },
  },
];
