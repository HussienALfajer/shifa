# ADR-0013: API contract — REST + OpenAPI 3.1 generated from named Zod schemas; generated TypeScript and Dart clients

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Web apps (TypeScript) and the patient app (Dart) consume one API. In fox-drop, unnamed schemas produced a 120k-line Dart client with 553 model files, needless nullability, non-exhaustive enums, a Java dependency and 10k–24k-line PR diffs per route change [RN-22 §4–§5, §7].

## Decision
- `packages/contracts`: Zod 4 schemas, each explicitly named, with precise required/nullable/optional semantics and string enums. NestJS controllers validate with these schemas.
- An OpenAPI 3.1 document is generated from the contracts and committed; CI fails if it is stale.
- Generated clients live in their own packages: `packages/api-client-ts` and `packages/api_client_dart` (swagger_parser or another pure-Dart generator — no Java), both marked generated and protected from manual edits by a hook.
- One error envelope and a central error-code catalogue shared by server, web and app (codes also feed translations).
- Commands accept an `Idempotency-Key`; responses carry `Server-Time` for clock sync.
- Realtime events ([ADR-0015](0015-realtime-centrifugo.md)) carry only "what changed" (entity, id, version); clients refetch via REST.
- Test fixtures on both sides are validated against `openapi.json`.
- The Flutter app maps generated types into its own models; generated types never leak into widgets.

## Consequences
+ One contract for three client types and future integrations; drift is caught in CI.
+ Smaller, readable Dart output and reviewable PRs.
− Schema naming discipline is required; enforced by a lint on unnamed schemas.

## Alternatives considered
- tRPC: TypeScript-only; excludes the Flutter app.
- GraphQL: extra complexity without a clear benefit here.
- OpenAPI Generator dart-dio: json_serializable/freezed modes still beta and Java-based [RN-19 §B4].

## Sources
[RN-16 §15], [RN-19 §B4], [RN-22 §4–§5, §7]
