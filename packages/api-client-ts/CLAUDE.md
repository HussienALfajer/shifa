# @shifa/api-client-ts

Typed API client for the web apps, generated from `packages/contracts/generated/openapi.json` (ADR-0013).

- `src/generated/schema.ts` is `openapi-typescript` output: never edit it (a hook refuses). After `openapi.json` changes run `node scripts/check-drift.mjs --fix` and commit it; the `api-client-ts` drift check fails otherwise.
- `src/client.ts` is hand-written: `createApiClient({ baseUrl, fetch? })` returns an `openapi-fetch` client that sends cookies (`credentials: 'include'`). Auth, retries and error mapping come later.
- Import from the package root: `createApiClient`, `ApiClient`, `Schemas` (`Schemas['ErrorEnvelope']`), `paths`, `operations`.
- Tests: `test/client.test-d.ts` (Vitest typecheck: paths, methods and bodies), `test/client.test.ts` (runtime), `test/fixtures.test.ts` (the shared `packages/contracts/fixtures/responses.json` validated against `openapi.json` with Ajv, JSON Schema 2020-12).
