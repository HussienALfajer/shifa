# ADR-0037: Voice calling with self-hosted SILMA TTS; no cloud vendor

Status: Proposed · Date: 2026-11-19 · Deciders: product owner (with Claude) · Amends: [ADR-0020](0020-voice-calling-voice-packs.md)

## Context
ADR-0020 named Azure `ar-SY` as the primary TTS, Google as backup and SILMA as fallback. The cloud free tiers have monthly limits, need a payment card and tie clinics to a vendor's terms; the owner wants a voice that is free without limits (OD-51). Spike 0.3-S6 ([report](../spikes/s6-voice.md)) generated the full test set with SILMA TTS v1 and the owner rated all 177 clips blind: no wrong number, mean naturalness 4.14 of 5 (numbers 4.68), so SILMA met the acceptance bar (no wrong number, mean ≥ 3.5). Names were weaker: 31 of 120 name clips heard wrong; tashkeel cut errors from 8/20 to 3/20 on the same names. On an Android TV 16 emulator with Fully Kiosk (free) the cached page played calls with no tap, offline, gapless.

## Decision
- **Provider and voice:** SILMA TTS v1 (weights Apache-2.0, code MIT), its default reference voice (no cloned person), run by Shifa in a container pinned by package hashes and weight commits. No cloud TTS vendor; the Azure and Google adapters stay behind `TtsProvider` unused, and adding a vendor needs a new ADR.
- **Generation:** packs are batch jobs, once per pack version (chime, numbers 1–999 as full phrases, connectors, rooms). Name and room clips are generated asynchronously when entered; a call never waits for generation. A failed job keeps the previous pack version.
- **Fallback at the display (unchanged from VOX-18):** missing name clip → number-only call; missing number or room clip or pack → chime plus visual flash. There is no second voice at run time.
- **Text normalisation:** one normaliser writes numbers as Arabic words; names are diacritised before TTS and the receptionist preview (VOX-08) stays mandatory. Native-speaker sign-off of all 1–999 clips before a pack is published.
- **Display playback rules:** service-worker pack cache with manifest diff; clips decoded once and scheduled back-to-back with Web Audio; FIFO queue with a 1.5 s gap; `call_id` deduplication and a 60 s stale limit; a one-time tap gate on plain Chrome; Fully Kiosk plays without a tap; Wake Lock re-acquired when visible.

## Consequences
+ No vendor bill, quota, card or vendor terms; generation stays under Shifa's control and works for Syrian users.
+ Numbers, the part every call depends on, were rated best (4.68).
− Name pronunciation is the weak spot; number-only stays the default (OD-11) and the preview step is required.
− CPU generation is slow (~17 s per clip on a 32-thread desktop CPU; ~0.6 s on an RTX 4060): a full pack takes hours on CPU, and the server choice must weigh a GPU.
− The image is ~18 GB; Shifa runs and patches it.

## Alternatives considered
- Azure `ar-SY` primary (ADR-0020): free tier limited, card and vendor terms; not rated (OD-51).
- Google Chirp 3 HD: same limits.
- SILMA plus a cloud vendor as backup: rejected by the owner (OD-51).

## Sources
[Spike report](../spikes/s6-voice.md), OD-50, OD-51, [RN-15 §5–§6]
