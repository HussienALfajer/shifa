import { createConfig } from '@shifa/eslint-config';

export default [
  { ignores: ['test-results/**', 'playwright-report/**'] },
  // support/page.ts moves a session's last activity in the throwaway harness database, as a test
  // does with @shifa/db/testing: the journeys' only raw database access.
  ...createConfig({ tsconfigRootDir: import.meta.dirname, allowRawDb: ['support/page.ts'] }),
];
