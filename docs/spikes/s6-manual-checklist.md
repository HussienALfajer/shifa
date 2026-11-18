# Spike 0.3-S6 — owner's voice run (checklist)

Checkpoints C–E of [0.3-S6b](../slices/0.3-s6b-voice-listening-and-result.md), for criteria 1, 2, 5, 6, 9 and 10 of [spec 0.3-S6](../specs/spikes/0.3-s6-voice.md). Everything runs on the owner's Windows machine with Docker Desktop and Android Studio; CI never calls a vendor (OD-31). Commands run from the repository root (`D:\shifa`) in Git Bash. Claude runs the commands with the owner and stops at each step marked **(yes)** until the owner answers.

## Rules
- Keys live only in `spikes/s6-voice/.env.local` (git-ignored). Never paste a key into chat, an issue, a commit or the report. `check-no-keys` must pass before every commit.
- Free tiers only (OD-50). The generator refuses a run that would pass Azure F0 (500,000 characters per month) or Google's 1,000,000 Chirp 3 HD characters; do not raise the limits.
- Audio is never committed (`.out/` is git-ignored); manifests and results are.
- **Do not open** `listening-key.json` or `pre-round-key.json` before the analysis: the test is blind. The key is committed only after the analysis.
- The results JSON holds codes, scores and notes only. Write notes about the sound, never about a person.

## C. Keys, pre-round, generation

| # | Step | Command | Send back |
|---|---|---|---|
| C1 | Create the vendor resources on the free tiers: Azure AI Speech **F0** in a region of your choice; a Google Cloud project with Text-to-Speech enabled and an API key restricted to that API | (vendor consoles) | region name; "done" |
| C2 | Copy `spikes/s6-voice/.env.example` to `.env.local` and fill `S6_AZURE_KEY`, `S6_AZURE_REGION`, `S6_GOOGLE_KEY` | (editor) | "done" (never the values) |
| C3 | Key check on the clean tree | `pnpm --filter @shifa-spike/s6-tts check-no-keys` | the last line |
| C4 | Dry-run counts for every planned run | `pnpm --filter @shifa-spike/s6-tts generate --provider google --set pre-round --dry-run` then `--provider azure --dry-run` and `--provider google --dry-run` | the character counts |
| C5 | **(yes)** Approve the counts against the free limits | — | yes / no |
| C6 | Pre-round audio: six Chirp 3 HD voices × five phrases | `pnpm --filter @shifa-spike/s6-tts generate --provider google --set pre-round` | the summary line per voice |
| C7 | Build the pre-round page (a new random seed is printed; keep it) | `node spikes/s6-voice/tts/scripts/build-listening-set.ts --pre-round spikes/s6-voice/.out/google/*/manifest.pre-round.json` | the printed `set … (seed …)` line |
| C8 | Serve the page and pick one male and one female voice; **تنزيل الاختيار** saves `pre-round-choice.json` | `pnpm --filter @shifa-spike/s6-listening build` then `pnpm --filter @shifa-spike/s6-listening preview`; open `http://localhost:4173/?mode=pre-round` | move the file to `spikes/s6-voice/results/` |
| C9 | Map the pick to voices (records the date) | `node spikes/s6-voice/analysis/src/analyse.ts --pre-round --results spikes/s6-voice/results/pre-round-choice.json --key spikes/s6-voice/.out/listening/pre-round-key.json --out spikes/s6-voice/results` | the two voice names |
| C10 | SILMA: lock, build, run, check (`spikes/s6-voice/silma/README.md` steps 1–4); note CPU model, RAM and GPU if any | `sh spikes/s6-voice/silma/lock.sh`, `docker build …`, `docker run …`, `S6_SILMA=1 …` | build time, image size, test result |
| C11 | Full set for the five voices (Azure ×2, the two picked Google voices, SILMA) | `pnpm --filter @shifa-spike/s6-tts generate --provider azure`; `… --provider google --voice <male>`; `… --voice <female>`; `… --provider silma` (once on CPU; again with `--gpus all` into another `--out` folder if a GPU is present) | the summary line per voice; any `failed` clip |
| C12 | Re-run a voice with failed clips until none are left (only missing clips are regenerated) | the same command | summary line |
| C13 | Copy the five full manifests to `spikes/s6-voice/manifests/<provider>-<voice>.json` and the pre-round ones to `…/<voice>.pre-round.json`; run `check-no-keys` | `pnpm --filter @shifa-spike/s6-tts check-no-keys` | "ok" |

## D. Blind listening and analysis

| # | Step | Command | Send back |
|---|---|---|---|
| D1 | Build the listening set (885 clips, 20 pairs; a new seed is printed) | `node spikes/s6-voice/tts/scripts/build-listening-set.ts spikes/s6-voice/.out/azure/*/manifest.json spikes/s6-voice/.out/google/<male>/manifest.json spikes/s6-voice/.out/google/<female>/manifest.json spikes/s6-voice/.out/silma/default/manifest.json` | the `set … (seed …)` line |
| D2 | Serve the page; listen with headphones in a quiet room. Keys: ١–٥ (or 1–5) for naturalness, ص / خ for correct / wrong, space to replay, Enter for next. Breaks are fine: progress is saved in the browser | `pnpm --filter @shifa-spike/s6-listening build` then `… preview`; open `http://localhost:4173/` | how long it took, in sittings |
| D3 | After the 20 pairs, **تنزيل النتائج** saves `s6-results-<hash>.json`; move it to `spikes/s6-voice/results/` | — | "done" |
| D4 | Run the analysis | `node spikes/s6-voice/analysis/src/analyse.ts --results spikes/s6-voice/results/s6-results-<hash>.json --key spikes/s6-voice/.out/listening/listening-key.json --out spikes/s6-voice/results` | the printed decision |
| D5 | If the analysis says **no eligible winner**: Claude proposes a corrected text for the listed numbers; **(yes)** the owner confirms; regenerate those clips only and listen again to them | (Claude prepares the commands) | yes / no; the result |
| D6 | Copy the key to `spikes/s6-voice/results/listening-key.json` (and the pre-round key); commit results, key and analysis together | — | "done" |

## E. Android TV emulator

| # | Step | Command | Send back |
|---|---|---|---|
| E1 | Android Studio → Device Manager → new **Television** device (1080p) with the latest **Android TV (Google APIs)** x86_64 image; record the API level and the image revision (SDK Manager → SDK Platforms → show package details) | — | API level, image name and revision, emulator version (`emulator -version`) |
| E2 | Build a pack from the winning voice and serve the display | `node spikes/s6-voice/display/scripts/make-pack.ts --from spikes/s6-voice/.out/<provider>/<voice>`; `pnpm --filter @shifa-spike/s6-display build`; `pnpm --filter @shifa-spike/s6-display preview --port 4173` | the `voice pack …` line |
| E3 | Reach the host from the emulator as `localhost` (a service worker and Wake Lock need a secure context; `http://10.0.2.2` is not one) | `adb reverse tcp:4173 tcp:4173` | "ok" |
| E4 | **(yes)** Claude reads the current Fully Kiosk Browser free APK on fully-kiosk.com and asks with its name, version, size and SHA-256; download only after the yes; install | `adb install <file>.apk` | yes / no; version installed |
| E5 | Per runtime (Fully free; the emulator's browser or a WebView shell if the image has one): open `http://localhost:4173/?pack=voice`. Record: plays a call from the control page (`/control.html` on the host) **without a tap**? | (control page) | yes / no per runtime; Fully settings changed |
| E6 | Cache: wait for `ready`, then stop `preview`, turn the emulator network off (Extended controls → Cellular/Wi-Fi off), restart the emulator, open the page | — | plays from cache? clips cached (status line) |
| E7 | Wake Lock: set the display timeout to 1 minute; leave the page 5 minutes | — | screen stayed on? `wakeLock` in the status line |
| E8 | Gaps: record the host's audio output during 5 calls (Audacity → Windows WASAPI → loopback of the output the emulator uses → 48 kHz, 16-bit WAV); measure | `node spikes/s6-voice/tts/scripts/measure-gaps.ts <recording.wav>` | the JSON; compare with `__s6.renderOffline` in the page (the gaps inside the clips themselves) |
| E9 | First-call latency: reload, send a call at once; read `latency` in the status line | — | `loadToReadyMs`, `callToStartMs` |

## F. Numbers for the report (Claude)
- Pack size: `node spikes/s6-voice/tts/scripts/pack-size.ts --manifest spikes/s6-voice/.out/<provider>/<voice>/manifest.json` per voice (needs Docker; the ffmpeg image is pinned by digest and runs with no network).
- Generation time per clip and characters billed: from the manifests.
- Vendor terms: Claude quotes the clauses with links and the access date.
