import { createConfig } from '@shifa/eslint-config';

// The scenario harness bootstraps its own throwaway PostgreSQL as superuser (roles, database),
// like packages/db's test harness; nothing here runs in the application.
export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  allowRawDb: ['harness/stack.ts', 'harness/serve.ts'],
});
