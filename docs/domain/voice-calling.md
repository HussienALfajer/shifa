# Voice Calling (Waiting-Room Announcements)

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-15, RN-17, RN-06

Purpose: defines the waiting-room voice announcement system (نداء صوتي) that calls queue numbers into rooms. Calls are made in natural Syrian Arabic, Turkish is an optional second language for Azaz, and calls keep working with no internet. Audio is generated ahead of time on our servers and played locally on the display device. It is never synthesised at call time on the device (ADR-0020). Built in **Phase A**, together with [scheduling and queue](scheduling-queue.md).

Related: [scheduling and queue](scheduling-queue.md) · [patient app](patient-app.md) · [platform](platform-and-configuration.md) · [open decisions](../open-decisions.md)

## 1. Announcement content

- VOX-01 The default sequence is a chime (~1 s), then "الرقم {N}", then "إلى {room label}". Room labels are neutral (for example "العيادة ٢"), and naming the doctor ("عيادة الدكتور {X}") is a clinic setting [RN-15 §11].
- VOX-02 Calling is **number-only by default**. Surnames, specialty and diagnosis are never spoken [RN-15 §2].
- VOX-03 First-name mode is a clinic opt-in. In this mode the call is a chime, then "{first name}", then "الرقم {N}", then the room. Each patient can opt out ("لا تنادِ باسمي"), and the number is always included.
- VOX-04 Dual-language mode for Azaz plays the Arabic sequence, a 0.6 s pause, then the Turkish sequence. The Turkish wording must be reviewed by a native speaker (OD-11).
- VOX-05 Each call plays once by default, configurable to twice. Recall replays the identical sequence.

## 2. Audio generation (server side, outside Syria)

- VOX-06 Voice packs are generated once per language and voice, with Azure neural TTS `ar-SY` voices (Laith/Amany) as the primary and `tr-TR` voices for Turkish. Each pack contains:
  - the chime;
  - "الرقم N" for N = 1–999 as full-phrase clips, so Arabic number grammar is fixed at generation and never assembled at runtime;
  - connector phrases.
  Packs are versioned with a manifest of hashes [RN-15 §5, §11].
- VOX-07 A clinic's room and doctor phrases are generated when the clinic configures its rooms. Staff preview them before they are published.
- VOX-08 Name clips are optional and generated when a patient is registered or booked, never at call time. The pipeline is: shared name lexicon → automatic diacritisation (tashkeel) → receptionist preview and correction → TTS → a global cache keyed by a hash of the diacritised text, shared across tenants, with no patient link stored in the cache.
- VOX-09 TTS sits behind a `TtsProvider` interface (Azure, Google, self-hosted SILMA as fallback), so changing provider only triggers regeneration [RN-15 §6].
- VOX-10 Clinic devices only download audio files from Shifa servers. They never call TTS vendors directly, because vendor access from inside Syria is restricted [RN-15 §5].

## 3. Display client

- VOX-11 The display is a kiosk web page (`display-web`) that caches the full voice pack and today's name clips in Cache Storage/IndexedDB through a service worker, and checks the manifest diff on every connection.
- VOX-12 Playback uses Web Audio, with clips decoded once and scheduled back-to-back for gapless joins.
- VOX-13 Calls go through a serialised FIFO audio queue with a 1.5 s gap, so announcements never overlap.
- VOX-14 Every call shows a full-screen flash of the number and room (~8 s) synchronised with the audio, and a permanent "last 5 calls" strip, which also serves hearing-impaired patients.
- VOX-15 A clinic-defined volume schedule (for example quieter in the evening) is applied automatically.
- VOX-16 Every call carries a `call_id`. The display ignores duplicates and calls older than ~60 s, and sends a `played` acknowledgement back.
- VOX-17 Wake Lock is re-acquired whenever the page becomes visible again. On plain Chrome, a one-time "اضغط لتفعيل الصوت" button unlocks audio [RN-17 §12].
- VOX-18 If a name clip is missing, the call falls back to number only. If the whole pack is missing, the chime and the visual flash are used.

## 4. Local mode (no internet)

- VOX-19 Tier 1, the recommended default for single-room clinics: the reception PC drives the TV as a second HDMI screen. The reception app and the display window talk through `BroadcastChannel`, so calling works with zero internet. Calls are logged locally and uploaded later.
- VOX-20 Tier 2, for multi-room clinics: an Android TV box running Fully Kiosk Browser (PLUS licence, ~€6–8 one-time per device, unverified price) receives calls over the realtime channel. When the clinic is offline, the receptionist sees "the screen is not connected".
- VOX-21 A LAN relay box (a small local server) for multi-room offline calling (Later).

## 5. Controls

- VOX-22 Reception has these controls per doctor queue card: Next, Recall, Call specific patient, No-show, Skip.
- VOX-23 A doctor can call the next patient or recall from their own room on a phone or tablet page.
- VOX-24 Display status is shown at reception: online/offline, last heartbeat, last played call. A "test sound" button plays a test call.
- VOX-25 The day's call log records who called whom, when, and whether the call was acknowledged as played.
- VOX-26 When a patient is called, their app receives a push: "تفضّل إلى العيادة ٢" (see [patient app](patient-app.md)).
- VOX-27 Settings: language mode, repeat count, name mode, room labels, volume schedule, voice (male/female).

## 6. Privacy

- VOX-28 Name clips are purged from display devices at the end of the day.
- VOX-29 Audio and the display never show surnames, diagnosis or specialty.

## 7. Validation before build (OD-11)

1. A blind listening test of Azure `ar-SY` against Google Chirp 3 HD and SILMA, using 100 Syrian first names and 50 numbers, with 5 receptionists from Aleppo and Azaz.
2. Confirm the vendor terms of service and the export-control position for generating audio for Syrian end users from a non-Syrian account.
3. A native-speaker review of the Turkish template.
4. Test autoplay, service-worker caching and Wake Lock on 2–3 cheap Android TV boxes sold locally.

## Key entities

- `voice_pack`: language, voice, version, manifest of clip hashes.
- `tenant_phrase`: room and doctor labels with diacritised text and clip hash.
- `name_clip_cache`: global audio cache keyed by a hash of the diacritised name, with no patient link.
- `call_event`: `call_id`, ticket, room, clip list, timestamps, played acknowledgement.
- `display_device`: zone, status, last heartbeat, pack version.
- `voice_settings`: per clinic or branch settings.

## Verification notes

- An audio-queue test enqueues 5 calls within 1 second, then checks they play in order with no overlap and that each produces an acknowledgement.
- Offline tests:
  - Tier 1 calls still play with the network disabled.
  - Name-clip fallback works.
  - A corrupted pack falls back to chime plus flash.
- A stale or duplicate test replays an old `call_id` and checks it is ignored.
- A number-grammar QA checklist confirms a native speaker has signed off every clip from 1 to 999 before the pack is published.
- A privacy test checks that the display DOM and audio contain no surname or diagnosis fields.
