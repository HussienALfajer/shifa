# Spike S6 result: voice calling with SILMA TTS

Date: 2026-11-19 (owner's machine) · Spec: [0.3-S6](../specs/spikes/0.3-s6-voice.md) · Slices: [0.3-S6a](../slices/0.3-s6a-voice-generation-and-display.md), [0.3-S6b](../slices/0.3-s6b-voice-listening-and-result.md) · Decision: [ADR-0037](../adr/0037-voice-silma-self-hosted.md) (Proposed), amending [ADR-0020](../adr/0020-voice-calling-voice-packs.md) · Requirements: VOX-01, VOX-03, VOX-06, VOX-08–VOX-18 · Decisions: OD-11, OD-50, OD-51

## Answer
**SILMA TTS v1, self-hosted, is good enough to be Shifa's only voice: in the owner's blind rating of all 177 clips no number was wrong and the mean naturalness was 4.14 of 5 (numbers 4.68). Names are the weak spot (31 of 120 heard wrong), so number-only stays the default and the tashkeel preview stays. On an Android TV 16 emulator, Fully Kiosk's free version plays cached calls with no tap, also with its server unreachable, with clips scheduled back to back and the screen kept on.**

- **Scope changed by the owner (OD-51, 2026-11-19):** SILMA only. Azure and Google were not generated or rated (free tiers need a card and have monthly limits), so there was no pre-round and no pair comparison; the decision rule became an acceptance bar: no wrong number and a mean naturalness of at least 3.5. SILMA passed it.
- **Numbers:** 0 of 50 wrong; mean 4.68 (sd 0.71). Every grammar case in the set (1, 2, 3–10, 11, 12, 13–19, 20, 21, 99–102, 110–112, 119, 120, 200, 215, 300, 640, 800, 999 and others) was heard right.
- **Names:** 23 of 100 diacritised and 8 of 20 undiacritised names heard wrong. The misses are both short common names (هِبَة، رَنَا، هُدَى، حَسَن، خَالِد) and Kurdish and Turkmen names common in Azaz (آزَاد، بَهُوز، آدَار، دِيلَك، أَيْتَن، تُورْغُوت، أَرْطُغْرُل).
- **Tashkeel matters (VOX-08):** on the 20 names heard in both forms, 3 were wrong with tashkeel and 8 without. The receptionist preview and correction step stays.
- **CPU speed:** 16.9 s per clip on a 32-thread desktop CPU (real-time factor 17.9); 0.58 s on an RTX 4060 laptop GPU (factor 0.58). A full pack is hours on CPU and minutes on GPU; name clips are generated ahead of the call, so 17 s is acceptable for them.
- **Display:** load to ready 0.9–1.1 s from cache; a call sent right after a reload starts 0.36–0.62 s after it; clips are scheduled back to back (an offline render of 5 calls shows silences of 7–84 ms, pauses inside the clips included). The emulator's real output was not recorded.
- **Why names fail:** of the 22 names whose plain form ends in ى, ا or ة, 9 were heard wrong (41 %); of the other 78, 14 (18 %). Their tashkeel looks standard, which points to SILMA's handling of a final vowel more than to the name list.

## Versions tested
SILMA TTS v1: `silma-tts` 1.0.5 (PyPI, hash-locked with 157 other packages, PyTorch 2.15.0+cu132), weights `silma-ai/silma-tts` at commit `226dd7a6` (`model.pt` SHA-256 `f43256d0…7336c`), vocoder `charactr/vocos-mel-24khz` at `0feb3fdd`, CATT tashkeel ONNX model (release v2, SHA-256 `5343bfdf…2ceac`); base image `python:3.12-slim-bookworm@sha256:935c3c5b…`; image 18 GB. Default reference voice (no cloned person). Android TV emulator: image `system-images;android-36;android-tv;x86` revision 4 (Android 16, `BT2A.260319.001`), device `tv_1080p`, emulator 36.3.10.0, Android System WebView 143.0.7499.24; Fully Kiosk Browser 1.61.4 free (SHA-256 `42df2da1…3dec7`, signer CN=Alexey Ozerov). Chromium through Playwright 1.65.1 for the automated suite. Machine: Windows 11 Pro, Intel Core i9-14900HX (32 threads), 32 GB, NVIDIA RTX 4060 Laptop 8 GB, Docker Desktop 29.2.1.

## Evidence per criterion
| # | Result | Proof |
|---|---|---|
| 1 | `TtsProvider` with Azure, Google and SILMA adapters; the SILMA container answered the live test (4/4); 177 clips + chime generated on CPU and on GPU, 0 failed | 0.3-S6a tests; `spikes/s6-voice/manifests/silma-default{,.gpu}.json` |
| 2 | Not run: one voice (OD-51) | slice 0.3-S6b |
| 3, 4 | Test set as specified; 100 public first names with tashkeel compiled by Claude. **The owner's tashkeel review (0.3-S6a checkpoint B) was not recorded before generation**, so a name heard wrong may be a lexicon error, not SILMA's | 0.3-S6a; `spikes/s6-voice/data/names.json` |
| 5 | Blind page: random codes and order (seed 1364424875), heard-to-the-end rule, saved progress, results download | `listening/e2e/*.spec.ts` (Playwright, 9 passed on the final head, 2026-11-19) |
| 6 | Analysis joins results and key; OD-51 acceptance applied | `analysis/test/*.test.ts` (17 passed); `spikes/s6-voice/results/analysis.md` |
| 7, 8 | Cache, queue, `call_id`, fallbacks, gesture gate, autoplay flag, Wake Lock | 0.3-S6a Playwright suite (workflow `s6-voice`) |
| 9 | Android TV emulator with Fully free: autoplay with no tap, cache after a reboot with the origin down, screen on (Fully's flag), joins scheduled back to back. **Not met as specified:** the output was not recorded, so audible gaps are not measured | below |
| 10 | Generation time, pack size, compute per clinic, first-call latency | below |
| 11 | Licences quoted (no cloud vendor used) | below |
| 12 | This report, ADR-0037, OD-11, roadmap, `docs/domain/voice-calling.md` | — |

## Listening result (criteria 5–6)
The owner rated all 177 clips in one 11-minute sitting on 2026-11-19 in the listening page (the app's browser pane); results, key and analysis are committed in `spikes/s6-voice/results/` and a test reruns the analysis to the same bytes.

| Category | Clips | Mean naturalness (sd) | Heard wrong |
|---|---|---|---|
| All | 177 | 4.14 (1.29) | — |
| Numbers "الرقم N" | 50 | 4.68 (0.71) | 0 |
| Names, diacritised | 100 | 4.02 (1.41) | 23 |
| Names, undiacritised | 20 | 3.65 (1.50) | 8 |
| Rooms "إلى العيادة رقم N" | 5 | 3.20 (0.45) | — |
| Doctor phrases | 2 | 4.00 (0.00) | — |

Rooms were rated lowest of the fixed phrases (3.20); room phrases are few per clinic, so a clinic can regenerate or reword them at the VOX-07 preview. One listener: means describe the owner's ratings and no significance is claimed.

## Android TV emulator (criterion 9)
Run by Claude on the owner's machine (owner's go-ahead), page `http://localhost:4173/?pack=voice` through `adb reverse`, SILMA pack `939274407f7d3a9f` (178 clips). The image has no browser app, so the only runtime was Fully's WebView.

| Check | Fully Kiosk 1.61.4 free |
|---|---|
| Autoplay without a tap | **Yes**: `audio: running`, no gate, on first start and after every reload; calls play chime → name → number → room |
| Cache with the origin down, after an emulator reboot | **Yes**: 178/178 clips from the service worker, ready in 1.9 s, a call played in full |
| Screen on (timeout and sleep set to 1 min, 5 min idle) | **Yes**: awake, no screensaver. The lock is Fully's window flag, so the page's Wake Lock alone is not shown to keep a box awake |
| Gapless joins | Not measured on the output (no loopback recording). Scheduled starts are back to back; 5 calls rendered offline in the page: longest silence 7–84 ms, pauses inside clips included |
| Settings changed | None for playback. For the test only: Advanced Web Settings → Enable Webview Contents Debugging, to send calls over DevTools |

**Fully free vs PLUS:** free played every call with only the start URL set. Kiosk lock-down, remote admin and the screensaver are PLUS features, not needed for playback; whether clinics buy PLUS for lock-down is a Phase A choice. Start on boot (recovery after a power cut) was not tested. The host's control page cannot reach a TV (BroadcastChannel stays in one browser): real calls arrive over the realtime channel (VOX-20).

## Measurements (criterion 10)
**Generation time** (177 clips + chime, mean clip 0.94 s of audio):

| Hardware | Total | Per clip mean (median, p95, max) | Real-time factor |
|---|---|---|---|
| CPU, i9-14900HX, 32 threads | 50 min | 16.9 s (16.2, 19.4, 20.9) | 17.9 |
| GPU, RTX 4060 Laptop 8 GB | 103 s | 0.58 s (0.54, 0.70, 2.7 first call) | 0.58 |

**Pack size** (`pack-size.ts`: each of the 178 clips encoded by the pinned ffmpeg 7.1 image; the full pack of chime, numbers 1–999 and 20 rooms extrapolated from per-category means, since no full pack was generated):

| Format | Full pack | Mean name clip |
|---|---|---|
| Opus 24 kbit/s | 5.16 MB | 1.9 KB |
| Opus 32 kbit/s | 6.84 MB | 2.5 KB |
| MP3 48 kbit/s | 10.68 MB | 4.1 KB |
| MP3 64 kbit/s | 14.16 MB | 5.4 KB |

Opus 32 kbit/s is under 7 MB per voice, small enough for a TV box's cache and a slow first download; a day's name clips add a few hundred KB. The spike played WAV (178 clips, 24 kHz); the pack format for `display-web` is chosen in Phase A.

**Compute per clinic:** no vendor characters are billed. A full voice pack (999 numbers, 20 rooms, chime) is about 1,020 clips: about 4.8 hours on the CPU above or 10 minutes on the GPU, once per voice version and shared by every clinic. Name clips are cached globally by diacritised text, so a clinic adds work only for names not seen before: at most about 300 a month for 300 new patients, i.e. under 1.5 CPU hours. A small cloud server has far fewer cores than this desktop; its speed was not measured.

**First-call latency** (emulator, Fully): load to ready 7.2 s on first visit over the network, 0.93–1.11 s from cache; a call sent as soon as the page's hook existed after a reload (0.36–0.80 s into the load, before the pack was ready) starts 0.36–0.62 s after it was sent (three runs).

## Licences and terms (criterion 11)
No cloud vendor is used (OD-51), so Azure's and Google's terms no longer apply. SILMA (checked 2026-11-19 on the [model card](https://huggingface.co/silma-ai/silma-tts) and [GitHub](https://github.com/SILMA-AI/silma-tts)): weights "Apache-2.0 License", code "MIT License", described as for "research and commercial use". Vocos vocoder: MIT ([charactr/vocos-mel-24khz](https://huggingface.co/charactr/vocos-mel-24khz)); CATT tashkeel: Apache-2.0 ([abjadai/catt](https://github.com/abjadai/catt)). The model card's disclaimer asks users to clone voices only with consent and to disclose AI-generated audio when sharing it; Shifa uses the default voice, and whether the waiting room shows such a notice is the owner's call (not decided here). Generation runs on Shifa's servers; clinics only download audio (VOX-10).

## Risks left
- **A real TV box** must pass autoplay, cache, wake, start on boot after a power cut and sound before the first pilot (OD-50), with the output recorded to measure gaps; the emulator's screen lock was Fully's window flag and its output was not recorded.
- **Names:** 23 % of diacritised names were heard wrong; number-only stays the default and name mode needs the preview (OD-11 keeps the name-calling default open). The tashkeel of the test names was not reviewed by the owner before generation, so part of this rate may be wrong tashkeel in the list rather than the voice; a check of the 23 against their tashkeel would separate the two.
- **Turkish** was not tested (OD-11).
- **Server hardware:** CPU-only generation of a full pack takes hours; the server choice must weigh a GPU or a one-time GPU job.
- **Google blocks Android SDK downloads from Syria** (every `dl.google.com/android` file answered 404; a Turkish VPN exit was blocked too, a UK exit worked): setting up Android tools for clinics needs a route outside Syria.
- **1–999 sign-off** by a native speaker before the first pack is published (Phase A).
