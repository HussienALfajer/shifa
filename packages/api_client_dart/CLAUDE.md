# api_client_dart

Dart API client for the Flutter patient app, generated from `packages/contracts/generated/openapi.json` (ADR-0013, ADR-0012). Pub workspace member; Turborepo wrapper in `package.json`.

- `lib/src/generated/` is generated (swagger_parser 1.46.0 → json_serializable models and retrofit/dio clients, then build_runner and `dart format`): never edit it (a hook refuses). Settings live in `swagger_parser.yaml`.
- Regenerate with `node scripts/check-drift.mjs --full --fix` (about a minute). It generates in a standalone temp copy of the package (offline, from the workspace `pubspec.lock`) and syncs the output; never run swagger_parser or build_runner into `lib/` by hand. The `api-client-dart` drift check runs in `verify:full` and CI only.
- Size budget: the drift entry in `scripts/drift.config.mjs` fails above 45 files or 1400 lines (≈ 3 × the 2026-11-11 output). A slice that adds endpoints raises it in its PR; a sudden jump usually means an unnamed schema in `packages/contracts`.
- `lib/api_client_dart.dart` exports only the generated clients (`ShifaApi`, one client per tag; untagged operations are in `CoreClient`) and models. Apps map them into their own models.
- Enums are exhaustive (`unknown_enum_value: false`): an unknown value fails decoding. swagger_parser ignores `const`, so `HealthStatus.status` is a plain `String`.
- `test/fixtures_test.dart` decodes and round-trips the shared `packages/contracts/fixtures/responses.json`.
