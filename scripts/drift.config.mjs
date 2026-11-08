// Registry of drift checks run by scripts/check-drift.mjs (shape documented in lib/drift.mjs).
// A new generated artefact (OpenAPI, API clients, translations, design tokens) adds one entry.
import { migrationsCheck } from './lib/drift-migrations.mjs';

export default [migrationsCheck({ dbDir: 'packages/db' })];
