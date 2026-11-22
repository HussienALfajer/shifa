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
- Turborepo only sees `package.json`: when a Dart package depends on another workspace package in `pubspec.yaml`, mirror it in `package.json` (`"dependencies": { "@shifa/dart-testing": "workspace:*" }`) so `--affected` and the cache follow the dependency.
- Changing the Flutter version: update `.fvmrc`, the `flutter:` constraint of `packages/shifa_ui` and the spike probes, then `FLUTTER_VERSION` and `FLUTTER_SHA256` in every workflow that installs Flutter (`ci.yml`, `s1-offline.yml`, `s3-arabic-output.yml`, `s7-push.yml`) from Google's `releases_linux.json`; `scripts/test/flutter-version.test.mjs` checks they agree.
- The Flutter pin and the Dart client's generators share one resolution: `flutter_test` pins `test_api`, and the `test` release on that `test_api` must accept the `analyzer` that `build_runner` needs. Before a bump, find that `test` release (Flutter 3.50.1: `test_api` 0.7.14 → `test` 1.32.0, `analyzer` 14) and pin it exactly in `api_client_dart` and `shifa_testing`; a bump with no such release is refused.
- `package:flutter/material.dart` is deprecated from Flutter 3.47 (Material moves to `package:material_ui`): `shifa_ui` uses the widgets layer only (`package:flutter/widgets.dart`).
- `very_good_analysis` is the rule set. Do not silence a rule per line without a comment saying why; never disable `unawaited_futures` or `discarded_futures`.
- Generated Dart (`*.g.dart`, `*.freezed.dart`, `*.mocks.dart`, `generated/`, including `packages/api_client_dart/lib/src/generated/`) is never edited by hand; change the source and re-run the generator.
- Hand-written `.dart` files stay under 400 lines (blank lines and comments not counted); `scripts/check-file-length.mjs` enforces it.
- Dependencies: pick versions published at least 24 hours ago (the same rule pnpm enforces); commit `pubspec.lock`.
