---
paths:
  - "**/*.dart"
  - "**/pubspec.yaml"
  - "analysis_options.yaml"
  - ".fvmrc"
---

# Dart and Flutter

- Flutter is pinned in `.fvmrc` (FVM). Run tools through `node scripts/dart.mjs <dart|flutter> ...` or `fvm dart` / `fvm flutter`; never the global `C:\flutter` or any SDK on PATH.
- One pub workspace: the root `pubspec.yaml` lists every Dart package; each package has `resolution: workspace` and a thin `package.json` so Turborepo runs `typecheck` (`dart analyze --fatal-infos`), `lint` (`dart format` check) and `test`.
- Changing the Flutter version: update `.fvmrc`, then `FLUTTER_VERSION` and `FLUTTER_SHA256` in `.github/workflows/ci.yml` from Google's `releases_linux.json`.
- `very_good_analysis` is the rule set. Do not silence a rule per line without a comment saying why; never disable `unawaited_futures` or `discarded_futures`.
- Generated Dart (`*.g.dart`, `*.freezed.dart`, `*.mocks.dart`, `generated/`, `packages/api_client_dart`) is never edited by hand; change the source and re-run the generator.
- Hand-written `.dart` files stay under 400 lines (blank lines and comments not counted); `scripts/check-file-length.mjs` enforces it.
- Dependencies: pick versions published at least 24 hours ago (the same rule pnpm enforces); commit `pubspec.lock`.
