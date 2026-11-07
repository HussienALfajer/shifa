# ADR-0012: Patient app in Flutter with the official MVVM architecture and Riverpod 3

Status: Accepted · Date: 2026-11-08 · Deciders: product owner

## Context
The patient app targets Android first (about 95–96% of Syrian mobile traffic, many low-end devices), Arabic RTL, family profiles, live queue tracking and offline tolerance. On 2026-11-07 research recommended React Native + Expo for TypeScript code sharing [RN-17 §8]; on 2026-11-08 the owner chose Flutter for a "professional and creative" app. Flutter renders RTL natively, is consistent on low-end Android, and is moving toward custom design systems (Material and Cupertino split into packages in 3.47) [RN-19 §B1].

## Decision
- Flutter 3.47.x (pinned with FVM), Android-first (minSdk 24), iOS later.
- Architecture: the official Flutter guide — views, view models, repositories, services; use-cases only when logic is shared.
- State: Riverpod 3 with riverpod_lint; its experimental offline persistence and mutations are not used for clinical data.
- Libraries: go_router, freezed, the generated Dart API client ([ADR-0013](0013-api-contract-openapi-zod.md)) mapped into app-owned models/sealed classes, drift encrypted with SQLCipher plus a pending-write queue (PowerSync only if the spike in [ADR-0014](0014-offline-sync-engine.md) selects it), firebase_messaging, flutter_secure_storage, sentry_flutter (pointing at GlitchTip), fl_chart.
- UI: `shifa_ui` package generated from the shared tokens ([ADR-0011](0011-design-system-base-ui.md)); Rive for a few signature animations; animation helpers wrapped behind our own API.
- Localisation: ARB files generated from the shared i18n source; Arabic plurals; RTL default.
- Quality: very_good_analysis, `unawaited_futures`, golden tests (alchemist), integration tests (patrol or Maestro), performance budget on a 2–3 GB RAM Android device.
- Distribution: Google Play (owner's developer account) plus direct APK fallback; Shorebird code push to be confirmed for 3.47 (unverified).
- Claude Code: official Flutter plugin skills and the Dart MCP server (experimental); their rules are copied into the app's CLAUDE.md.

## Consequences
+ Best-in-class RTL and rendering on low-end devices; a creative, branded app.
− A second language (Dart) and no component sharing with React; mitigated by contract codegen, shared tokens and shared i18n source.

## Alternatives considered
- React Native + Expo SDK 58: TypeScript sharing and react-native-svg reuse; RTL changes need an app restart; overridden by the owner [RN-17 §8].
- Kotlin/Compose Multiplatform: third language, smaller pool.
- PWA only: weaker push/offline on iOS; kept as the no-install companion via booking-web [RN-17 §10].

## Sources
[RN-19 §B1–§B13], [RN-17 §8–§10], [RN-22 §5, §7], [RN-03 §5]
