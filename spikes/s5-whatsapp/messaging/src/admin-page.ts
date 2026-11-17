// The manual run's local admin page lives in tools/ (owner-driven linking, QR and start/stop are
// not service code; breaker.test.ts keeps src/ free of them). Re-exported for the suites.
export { type AdminPage, startAdminPage } from '../tools/admin-page.ts';
