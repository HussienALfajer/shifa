# @shifa/contracts

Named Zod 4 schemas, route contracts, the error envelope and the error-code catalogue (ADR-0013). The API validates requests with them; `generated/openapi.json` is generated from them and committed.

## Layout
- `src/define.ts` `defineContract({ operationId, method, path, request: { params?, query?, body? }, responses })` and the `RequestParams/Query/Body<C>`, `ResponseBody<C, S>` helpers.
- `src/errors.ts` `ErrorCode`, `ErrorEnvelope` (`{ error: { code, message, details? } }`), `ValidationIssue`, `STATUS_ERRORS`, `envelopeFor()`.
- `src/<context>.ts` schemas and contracts per bounded context (`health.ts` today); export from `src/index.ts`.
- `src/lint.ts` the unnamed-schema lint, used by `test/named-schemas.test.ts` and the API generator.
- `generated/openapi.json` is generated: never edit it (a hook refuses). After any route or schema change run `node scripts/check-drift.mjs --fix` and commit it.

## Schema rules
- Every exported schema and every schema a contract uses directly carries `.meta({ id: 'PascalCase' })`, unique across the package. Nested objects and enums are their own named schemas too: the document may hold objects and enums only as components. The lint test and the start-up check fail otherwise.
- Required: a plain field. Can be absent: `.optional()`. Present but empty: `.nullable()`. Never both unless the API really sends both shapes.
- Enums are string enums (`z.enum([...])`), never numbers. Add values; never rename or reuse one.
- Query and path values arrive as strings: use `z.coerce.number()` / `z.stringbool()`.
- Path `:name` parameters must match the keys of the `params` object; `path` uses Nest style (`/patients/:id`).
- Responses list every success status the handler answers (POST defaults to 201 unless `@HttpCode`); 400/401/403 with `ErrorEnvelope` are added to the document automatically.
- Error codes come from `ErrorCode` only. A `validation_failed` error lists `details: [{ path, code }]`, never the submitted value.
