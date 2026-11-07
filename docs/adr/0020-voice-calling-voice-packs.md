# ADR-0020: Voice calling with pre-generated TTS voice packs played locally on the display

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The owner added a voice-calling system to the queue. Announcements must work during internet cuts, sound natural in Syrian Arabic, avoid privacy problems and optionally add Turkish for Azaz. Azure has Syrian Arabic neural voices (ar-SY-LaithNeural, ar-SY-AmanyNeural) and Turkish voices; Azure access from inside Syria is restricted, so generation must happen on our servers [RN-15 §5]. Chrome blocks autoplay without a gesture and Android WebView lacks Web Speech [RN-15 §4, §8] [RN-17 §12].

## Decision
- Announcement format: chime → "الرقم {N}" → "إلى {room}"; number-only by default. Name mode (first name or alias) is a clinic opt-in with a per-patient "do not call my name" flag; never surnames, specialty or diagnosis.
- Server-side generation outside Syria behind a `TtsProvider` interface (Azure ar-SY primary, Google as backup, SILMA self-hosted Apache-2.0 as fallback). Versioned voice packs: chime, full-phrase numbers 1–999 (correct Arabic number grammar fixed by text normalisation and native-speaker QA), connectors, tenant room/doctor phrases. Optional Turkish sequence for Azaz.
- Name clips (optional) are generated at registration/booking, after an Arabic diacritisation (tashkeel) preview the receptionist can correct, cached globally by hash with no patient linkage, prefetched to displays, purged from devices daily. If a name clip is missing, the number-only announcement plays.
- Display client (display-web): kiosk PWA caching packs in the service worker; Web Audio serial queue without overlap; visual flash and last-5-calls strip; acknowledgements back to reception; reconnect with resync ([ADR-0015](0015-realtime-centrifugo.md)).
- Local mode: reception PC drives the TV over HDMI and talks to the display window via BroadcastChannel — works with zero internet. Multi-room clinics: Android TV box + Fully Kiosk (PLUS) + UPS.
- Controls: next, recall, call specific patient, no-show, skip; doctor's in-room call page; display status indicator; test sound; call log; volume schedule. The patient app gets a "please go to room X" push.

## Consequences
+ Natural Syrian voice, offline-safe, cents per clinic per month.
− Depends on a vendor for generation; mitigated by the provider interface and cached packs.

## Alternatives considered
- Browser Web Speech: inconsistent Arabic voices, missing in kiosk WebViews.
- Live cloud TTS per call: fails offline and adds latency.
- Human-recorded packs: possible for numbers if the listening test prefers them (OD-11).

## Sources
[RN-15 §1–§11], [RN-17 §12]
