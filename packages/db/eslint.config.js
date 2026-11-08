import { createConfig } from '@shifa/eslint-config';

// The only package allowed to open raw connections: the client (src/) and the test harness.
export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  allowRawDb: ['src/**', 'test-harness/**'],
});
