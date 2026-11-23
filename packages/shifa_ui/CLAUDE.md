# shifa_ui

Shifa's Flutter design system for the patient app (spec 0.4 criterion 10, slice 0.4-08). Pub workspace member; Turborepo wrapper in `package.json`. Design doc: `docs/architecture/design-system.md` ("Flutter design system").

## Rules
- Widgets layer only: `package:flutter/widgets.dart`, never `material.dart` or `cupertino.dart` (split out in Flutter 3.47, deprecated from 3.50; `test/no_hardcoded_values_test.dart` refuses them in `lib/`). `alchemist` brings `material_ui` into tests only.
- Every value comes from `context.shifa` (`ShifaThemeData`: `colors`, `status`, `typography`, `spacing`, `shapes`, `motion`), built from `lib/src/generated/tokens.g.dart`. No `Color(0x…)`, `EdgeInsets` number or font family string in `lib/` (the same test). Status, alert and queue colours only from `status` (locked).
- `lib/src/generated/tokens.g.dart` and `fonts/` are written by the tokens build (`node scripts/check-drift.mjs --fix`), `glyphs.g.dart` by `pnpm --filter @shifa/ui icons:sync`; never edit them.
- A widget is coded only from a sheet the owner approved (ADR-0040; proposals canvas, page "Flutter base widgets · 0.4-08"). Flutter widgets are not synced to the design system; the sheet stays their reference and the goldens are the check.
- Pattern to copy (`lib/src/widgets/button.dart`): a `StatelessWidget` over `ShifaPressable` (one button in semantics, Enter and Space, pressed and keyboard-focus looks), at least `spacing.touchTarget` (48) tall, an `AnimatedContainer` for colours only, `ShifaMotion.duration(context, …)` so reduced motion stops it, Arabic default labels as parameters (`busyLabel`, `closeLabel`). Icons are `ShifaGlyph(ShifaGlyphs.…)`; directional glyphs mirror in RTL.
- Text fields: `ShifaTextField` turns Arabic-Indic and Persian digits Western as typed (OD-20).
- New Dart files: add their folder to the `lint` script in `package.json` if it is not there; 400 lines at most.

## Tests
- `test/support/harness.dart`: `pumpPhone` (a widget on a 390 × 844 Arabic RTL phone) and `pumpScreen` (a whole screen in a `Navigator`). Every widget test checks semantics, the 48 dp target, disabled behaviour and 200 % text.
- Goldens (`test/goldens/`, tag `golden`): `shifaGoldenTest` draws each state light beside dark, RTL, animations off; `pressAll` holds a press. CI goldens (`test/goldens/ci/`, text as blocks) are the **Linux** images: edge smoothing differs a little between operating systems, so `flutter test` compares them only on Linux (CI, WSL2) and skips them on Windows and macOS. Platform goldens are git-ignored, for looking at.

## Commands
- `node ../../scripts/dart.mjs flutter test` — all tests (CI goldens compared on Linux only).
- On Linux: `node ../../scripts/dart.mjs flutter test --update-goldens --tags golden` rewrites the CI goldens after an approved change; look at each changed image.
- Elsewhere: `pnpm --filter @shifa/dart-ui goldens [--update]` compares or rewrites them in Docker (`scripts/goldens.mjs`: the pinned Ubuntu image, the `.fvmrc` SDK checked against `FLUTTER_SHA256`); difference images land in `test/goldens/failures/`.
- `SHIFA_PLATFORM_GOLDENS=1 node ../../scripts/dart.mjs flutter test --update-goldens --tags golden` — also write readable images to `test/goldens/<os>/`.
