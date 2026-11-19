# ADR-0037: Voice calling with self-hosted SILMA TTS; no cloud vendor

Status: Proposed · Date: 2026-11-19 · Deciders: product owner (with Claude) · Amends: [ADR-0020](0020-voice-calling-voice-packs.md)

## Context
ADR-0020 made Azure `ar-SY` primary, Google backup and SILMA fallback. Cloud free tiers have monthly limits, need a card and bind clinics to vendor terms; the owner wants a voice free without limits (OD-51). In spike 0.3-S6 ([report](../spikes/s6-voice.md)) the owner rated all 177 SILMA clips blind: no wrong number, mean naturalness 4.14 of 5 (numbers 4.68), passing the bar (no wrong number, mean ≥ 3.5). Names were weaker: 31 of 120 heard wrong; tashkeel cut errors from 8/20 to 3/20. On an Android TV 16 emulator, Fully Kiosk free played cached calls with no tap, also with its server down.

## Decision
- **Voice:** SILMA TTS v1 (weights Apache-2.0, code MIT), default reference voice (no cloned person), run by Shifa in a container pinned by package hashes and weight commits. No cloud TTS vendor; the Azure and Google adapters stay unused behind `TtsProvider`. Adding a vendor, or a Turkish voice (untested; OD-11), needs a new ADR.
- **Generation:** packs (chime, numbers 1–999 as full phrases, connectors, rooms) are batch jobs per pack version; name and room clips are made asynchronously when entered; a call never waits for generation; a failed job keeps the previous pack.
- **Fallback (VOX-18, unchanged):** missing name clip → number-only call; missing number, room clip or pack → chime and visual flash. No second voice.
- **Normalisation:** one normaliser writes numbers as Arabic words; names are diacritised before TTS and the receptionist preview (VOX-08) stays mandatory; a native speaker signs off all 1–999 clips before a pack is published.
- **Display:** service-worker pack cache with manifest diff; clips decoded once and scheduled back to back with Web Audio; FIFO queue, 1.5 s gap; `call_id` dedup and 60 s stale limit; one-time tap gate on plain Chrome; Wake Lock re-acquired when visible. Fully Kiosk free suffices for playback; PLUS (lock-down, remote admin) is a Phase A choice.

## Consequences
+ No vendor bill, quota, card or terms; generation stays under Shifa's control.
+ Numbers, which every call uses, were rated best (4.68).
− Names are the weak spot: number-only stays the default (OD-11) and the preview is required.
− CPU generation is slow (~17 s per clip on a 32-thread desktop CPU, ~0.6 s on an RTX 4060): a full pack takes hours on CPU, so the server choice must weigh a GPU.
− An 18 GB image that Shifa runs and patches.

## Alternatives considered
- Azure `ar-SY` or Google Chirp 3 HD: limited free tiers, card, vendor terms; not rated (OD-51).
- SILMA plus a cloud backup: rejected by the owner (OD-51).

## Sources
[Spike report](../spikes/s6-voice.md), OD-50, OD-51, [RN-15 §5–§6]
