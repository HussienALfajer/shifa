import { createConfig } from '@shifa/eslint-config';

// The only package allowed to open raw connections: the client (src/), the test harness, and
// the operations scripts (the restore drill compares two of its own containers as superuser).
export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  allowRawDb: ['src/**', 'test-harness/**', 'scripts/backup-drill*.ts'],
});
