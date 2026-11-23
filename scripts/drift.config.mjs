// Registry of drift checks run by scripts/check-drift.mjs (shape documented in lib/drift.mjs).
// A new generated artefact (OpenAPI, API clients, translations, design tokens) adds one entry.
// Order matters: the API clients read the committed openapi.json, so openapi runs first.
import { apiClientDartCheck, apiClientTsCheck } from './lib/drift-api-clients.mjs';
import { i18nCheck } from './lib/drift-i18n.mjs';
import { migrationsCheck } from './lib/drift-migrations.mjs';
import { openapiCheck } from './lib/drift-openapi.mjs';
import { tokensCheck } from './lib/drift-tokens.mjs';

export default [
  migrationsCheck({ dbDir: 'packages/db' }),
  openapiCheck(),
  apiClientTsCheck(),
  // Budget ≈ 3 × the output of 2026-11-11 (14 files, 455 lines). When a slice adds real
  // endpoints, raise it in that PR, so the growth is reviewed (an unnamed schema shows up here).
  // A-01-03 (12 routes: setup links, MFA, super-admin clinics) took it to 66 files and 2,495
  // lines; raised to about 1.5 × that.
  apiClientDartCheck({ budget: { files: 100, lines: 3800 } }),
  i18nCheck(),
  tokensCheck(),
];
