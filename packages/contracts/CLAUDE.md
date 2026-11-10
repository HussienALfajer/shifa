# @shifa/contracts

Named Zod 4 schemas, route contracts, the error envelope and the error-code catalogue (ADR-0013). The API validates requests with them; `generated/openapi.json` is generated from them and committed.

## Layout
- `src/define.ts` `defineContract({ operationId, method, path, request: { params?, query?, body? }, responses })` and the `RequestParams/Query/Body<C>`, `ResponseBody<C, S>` helpers.
- `src/errors.ts` `ErrorCode`, `ErrorEnvelope` (`{ error: { code, message, details? } }`), `ValidationIssue`, `STATUS_ERRORS`, `envelopeFor()`.
- `src/<context>.ts` schemas and contracts per bounded context (`health.ts` today); export from `src/index.ts`.
- `src/lint.ts` the unnamed-schema lint, used by `test/named-schemas.test.ts` and the API generator.
- `generated/openapi.json` is generated: never edit it (a hook refuses). After any route or schema change run `node scripts/check-drift.mjs --full --fix` and commit it with the regenerated clients (`packages/api-client-ts`, `packages/api_client_dart`).
- `fixtures/responses.json` holds example response bodies (valid and invalid) that both clients' tests check against the document; add a case when a response schema is added. Synthetic values only.

## Schema rules
- Every exported schema and every schema a contract uses directly carries `.meta({ id: 'PascalCase' })`, unique across the package. Nested objects and enums are their own named schemas too: the document may hold objects and enums only as components. The lint test and the start-up check fail otherwise.
- Required: a plain field. Can be absent: `.optional()`. Present but empty: `.nullable()`. Never both unless the API really sends both shapes.
- Enums are string enums (`z.enum([...])`), never numbers. Add values; never rename or reuse one.
- Query and path values arrive as strings: use `z.coerce.number()` / `z.stringbool()`.
- Path `:name` parameters must match the keys of the `params` object; `path` uses Nest style (`/patients/:id`).
- Request schemas are documented in input shape (a `.default()` field is optional for callers), responses in output shape and open (no `additionalProperties: false`), so clients accept fields added later. A schema whose two shapes differ (default, transform) cannot serve both: split it into `<Name>Input` and `<Name>`; the generator stops otherwise. Two schemas never share an id.
- Query and params are `z.object`s. Records and catchalls are allowed; their keys show as `*` in 400 details.
- Responses list every success status the handler answers (POST defaults to 201 unless `@HttpCode`); 400/401/403 with `ErrorEnvelope` are added to the document automatically.
- Error codes come from `ErrorCode` only. A `validation_failed` error lists `details: [{ path, code }]`, never the submitted value.
