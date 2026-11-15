import { createConfig } from '@shifa/eslint-config';
import globals from 'globals';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  // The service worker is plain JS in the worker scope.
  { files: ['**/public/**/*.js'], languageOptions: { globals: globals.serviceworker } },
];
