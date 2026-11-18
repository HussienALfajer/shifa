# Spike 0.3-S6 — owner's voice run (checklist)

Checkpoints C–E of [0.3-S6b](../slices/0.3-s6b-voice-listening-and-result.md), for criteria 1, 5, 6, 9 and 10 of [spec 0.3-S6](../specs/spikes/0.3-s6-voice.md). **SILMA only** (OD-51, 2026-11-19): a fully free, self-hosted voice; no Azure or Google account, key or card is needed, and there is no pre-round and no pair comparison. Everything runs on the owner's Windows machine with Docker Desktop and Android Studio; CI never runs SILMA (OD-31). Commands run from the repository root (`D:\shifa`) in Git Bash. Claude runs the commands with the owner and stops at each step marked **(yes)** until the owner answers.

## Rules
- Audio is never committed (`.out/` is git-ignored); manifests and results are.
- **Do not open** `listening-key.json` before the analysis: the page shows clips under random codes and in random order.
- The results JSON holds codes, scores and notes only. Write notes about the sound, never about a person.
- Acceptance (OD-51): no wrong number and a mean naturalness of at least 3.5. A wrong number may be fixed by a corrected text in a regeneration the owner confirms.

## C. SILMA build and generation

| # | Step | Command | Send back |
|---|---|---|---|
| C1 | Start Docker Desktop and wait until it says it is running; note the CPU model, RAM and GPU (if any) from Task Manager → Performance | `docker version --format '{{.Server.Version}}'` | the version; CPU, RAM, GPU |
| C2 | **(yes)** Lock the Python dependencies with hashes, then build the image (downloads about 2.7 GB: weights, vocoder, tashkeel model; then one offline warm-up) | `sh spikes/s6-voice/silma/lock.sh`; `docker build -t shifa-s6-silma spikes/s6-voice/silma` | build time, image size (`docker images shifa-s6-silma`) |
| C3 | Run it on loopback only | `docker run --rm -p 127.0.0.1:8088:8088 shifa-s6-silma` (keep this terminal open) | "running" |
| C4 | Check the container | `S6_SILMA=1 pnpm --filter @shifa-spike/s6-tts exec vitest run test/silma.test.ts` | the summary line |
| C5 | Generate the full set on the CPU (177 clips plus the chime) | `pnpm --filter @shifa-spike/s6-tts generate --provider silma` | the summary line; any `failed` clip |
| C6 | Re-run until no clip has failed (only missing clips are regenerated) | the same command | summary line |
| C7 | If there is a GPU: stop the container, run it again with `--gpus all`, and generate into another folder to time it | `docker run --rm --gpus all -p 127.0.0.1:8088:8088 shifa-s6-silma`; `pnpm --filter @shifa-spike/s6-tts generate --provider silma --out "$PWD/spikes/s6-voice/.out/gpu"` | the summary line |
| C8 | Copy the CPU manifest to `spikes/s6-voice/manifests/silma-default.json`; run the key check | `pnpm --filter @shifa-spike/s6-tts check-no-keys` | "ok" |

## D. Listening and analysis

| # | Step | Command | Send back |
|---|---|---|---|
| D1 | Build the listening set (177 clips in random order, no pairs; a seed is printed: keep it for after the analysis) | `node spikes/s6-voice/tts/scripts/build-listening-set.ts spikes/s6-voice/.out/silma/default/manifest.json` | the `set …` line |
| D2 | Serve the page; press **ابدأ: تفعيل الصوت** (Chrome needs one click before sound); listen with headphones in a quiet room. A clip can be scored once it has played to its end. Keys: ١–٥ (or 1–5) for naturalness, ص / خ for correct / wrong, space to replay, Enter for next. Breaks are fine: progress is saved in the browser | `pnpm --filter @shifa-spike/s6-listening build` then `pnpm --filter @shifa-spike/s6-listening preview`; open `http://localhost:4173/` | how long it took, in sittings |
| D3 | After the last clip, **تنزيل النتائج** saves `s6-results-<hash>.json`; move it to `spikes/s6-voice/results/` | — | "done" |
| D4 | Run the analysis | `node spikes/s6-voice/analysis/src/analyse.ts --results spikes/s6-voice/results/s6-results-<hash>.json --key spikes/s6-voice/.out/listening/listening-key.json --out spikes/s6-voice/results` | the printed decision |
| D5 | If a number is wrong: Claude proposes a corrected text for it; **(yes)** the owner confirms; regenerate those clips only, listen to them again and rerun the analysis | (Claude prepares the commands) | yes / no; the result |
| D6 | Copy the key to `spikes/s6-voice/results/listening-key.json`; commit results, key and analysis together | — | "done" |

## E. Android TV emulator

| # | Step | Command | Send back |
|---|---|---|---|
| E1 | Android Studio → Device Manager → new **Television** device (1080p) with the latest **Android TV (Google APIs)** x86_64 image; record the API level and the image revision (SDK Manager → SDK Platforms → show package details) | — | API level, image name and revision, emulator version (`emulator -version`) |
| E2 | Build the SILMA pack and serve the display | `node spikes/s6-voice/display/scripts/make-pack.ts --from spikes/s6-voice/.out/silma/default`; `pnpm --filter @shifa-spike/s6-display build`; `pnpm --filter @shifa-spike/s6-display preview --port 4173` | the `voice pack …` line |
| E3 | Reach the host from the emulator as `localhost` (a service worker and Wake Lock need a secure context; `http://10.0.2.2` is not one) | `adb reverse tcp:4173 tcp:4173` | "ok" |
| E4 | **(yes)** Claude reads the current Fully Kiosk Browser free APK on fully-kiosk.com and asks with its name, version, size and SHA-256; download only after the yes; install | `adb install <file>.apk` | yes / no; version installed |
| E5 | Per runtime (Fully free; the emulator's browser or a WebView shell if the image has one): open `http://localhost:4173/?pack=voice`. Record: plays a call from the control page (`/control.html` on the host) **without a tap**? | (control page) | yes / no per runtime; Fully settings changed |
| E6 | Cache: wait for `ready`, then stop `preview`, turn the emulator network off (Extended controls → Cellular/Wi-Fi off), restart the emulator, open the page | — | plays from cache? clips cached (status line) |
| E7 | Wake Lock: set the display timeout to 1 minute; leave the page 5 minutes | — | screen stayed on? `wakeLock` in the status line |
| E8 | Gaps: record the host's audio output during 5 calls (Audacity → Windows WASAPI → loopback of the output the emulator uses → 48 kHz, 16-bit WAV); measure | `node spikes/s6-voice/tts/scripts/measure-gaps.ts <recording.wav> --threshold-db=-50` | the JSON; compare with `__s6.renderOffline` in the page (the gaps inside the clips themselves) |
| E9 | First-call latency: reload, send a call at once; read `latency` in the status line | — | `loadToReadyMs`, `callToStartMs` |

## F. Numbers for the report (Claude)
- Pack size: `node spikes/s6-voice/tts/scripts/pack-size.ts --manifest spikes/s6-voice/.out/silma/default/manifest.json` (needs Docker; the ffmpeg image is pinned by digest and runs with no network).
- Generation time per clip on the CPU (and the GPU): from the manifests.
- Licences: Claude quotes SILMA's code and weights licences with links and the access date.
