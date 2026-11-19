import { createConfig } from '@shifa/eslint-config';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The locked devices test splits the FCM token marker into its own template part on purpose,
    // so no token-shaped string sits in the repository (key-leak check, slice 0.3-S7a).
    files: ['test/devices.test.ts'],
    rules: { '@typescript-eslint/no-unnecessary-template-expression': 'off' },
  },
];
