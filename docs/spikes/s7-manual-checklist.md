# Spike 0.3-S7 — owner's push run (checklist)

Checkpoints C–E of [0.3-S7b](../slices/0.3-s7b-push-runs-and-result.md), for criteria 1–7 of [spec 0.3-S7](../specs/spikes/0.3-s7-push.md). Android emulators only (OD-52); the production Firebase project with its own spike Android apps. Everything runs on the owner's Windows machine with Android Studio; CI never calls FCM (OD-31). Commands run from the repository root (`D:\shifa`) in Git Bash. Claude runs the commands with the owner and stops at each step marked **(yes)** until the owner answers.

## Rules
- **Never commit or paste** `google-services.json`, the service-account key, or a full FCM token (ADR-0026). Both files are git-ignored; keep the key outside the repository. Reports show a 12-character token hash.
- Before every commit: `pnpm --filter @shifa-spike/s7-sender check:secrets` must print ok (it also runs in `pnpm verify`).
- Synthetic data only: the sender's texts name a "عيادة تجريبية" and a time, nothing else.
- No paid Firebase or Google Cloud product is enabled; FCM is free.
- The machine must not sleep during a run (Windows: Settings → System → Power → Screen and sleep → Never while plugged in).

## C. Firebase set-up and first push (criteria 1–3 real evidence)

| # | Step | Command | Send back |
|---|---|---|---|
| C1 | Android Studio → Device Manager: three devices with **Google Play** x86_64 images: `s7-api33` (API 33), `s7-latest` (newest stable API), `s7-noshow` (API 33, for criterion 5). Record the image revisions (SDK Manager → SDK Platforms → show package details) | `emulator -version`; `adb version`; `adb devices` | API levels, image names and revisions, emulator and adb versions, the serials |
| C2 | On each emulator open the Play Store once and sign in with a test Google account if asked (Google Play services must be up to date) | `adb -s <serial> shell dumpsys package com.google.android.gms \| grep versionName` | Play services version per emulator |
| C3 | **(yes)** Firebase console → the production project → Add app → Android: package `dev.shifa.spike.s7push`, nickname "s7 spike"; again for `dev.shifa.spike.s7push.noshow`. Skip SHA-1. Do not enable any paid product | — | "added"; the two Android app ids (`1:…:android:…`, not secret) |
| C4 | Download `google-services.json` (it holds both apps) to `spikes/s7-push/probe/android/app/google-services.json` | `git status --short spikes/s7-push` | must show nothing new |
| C5 | **(yes)** Google Cloud console → IAM → Service accounts → Create `s7-push-sender`, role **Firebase Cloud Messaging API Admin** (holds `cloudmessaging.messages.create`), no other role. Keys → Add key → JSON; save it outside the repository, e.g. `C:\Users\<you>\keys\s7-push-sender.json`. If key creation is blocked by an organisation policy, say so and stop | — | "created"; the role shown on the account |
| C6 | Create `spikes/s7-push/.env.local` with one line: `S7_SERVICE_ACCOUNT_FILE=C:/Users/<you>/keys/s7-push-sender.json`; then run the key-leak check | `pnpm --filter @shifa-spike/s7-sender check:secrets` | "ok" |
| C7 | Start the receiver (keep this terminal open) | `pnpm --filter @shifa-spike/s7-receiver start` | "listening" line |
| C8 | Build and install the probe on each emulator (`compliant` on `s7-api33` and `s7-latest`, `noshow` on `s7-noshow`); open it once, tap **احجز موعداً**, allow notifications | from `spikes/s7-push/probe`: `node ../../../scripts/dart.mjs flutter run -d <serial> --flavor compliant --dart-define=S7_RECEIVER=http://10.0.2.2:8787` (`--flavor noshow` for the third) | Flutter version line; "allowed" |
| C9 | List the installs the receiver knows (no tokens) | `pnpm --filter @shifa-spike/s7-scenarios devices` | the three lines (install id, sdk, permission, channel) |
| C10 | First push, app in the foreground, then in the background (press Home first) | from `spikes/s7-push/sender`: `pnpm send --kind reminder --appointment first-1 --to <installId>` | the printed line; did it show? |
| C11 | Record the notification list once with the push in the tray, on each API, as watcher fixtures (Claude checks the parser against them) | `adb -s <serial> shell dumpsys notification --noredact > spikes/s7-push/.out/dumpsys-<api>.txt` | "saved" |
| C12 | Inbox and state: open the probe; the inbox shows both messages; `devices` shows `permission=granted appointments=high` | `pnpm --filter @shifa-spike/s7-scenarios devices` | yes / no |

## D. State matrix, deprioritisation, pending limit (criteria 4–6)

Each run sends 20 messages 30 s apart (about 12 minutes with the settle time) and writes `spikes/s7-push/runs/<date>-<state>-api<n>/`. Run every state on `s7-api33`, then on `s7-latest`.

| # | Step | Command | Send back |
|---|---|---|---|
| D1 | The graded states, one at a time: `foreground`, `background`, `swiped`, `screen-off`, `doze`, `bucket-rare`, `reboot`, `offline-ttl-long`, `offline-ttl-expire`, `offline-ttl-expire-nocollapse`, `slow-link` | `pnpm --filter @shifa-spike/s7-scenarios run-state --state <name> --serial <serial> --install <installId>` | the `written …` line per run |
| D2 | The excluded states: `force-stopped`, `bucket-restricted`, `permission-denied`, `channel-off` (this one asks you to flip the "مواعيد" channel in Settings, then press Enter; again to turn it back on) | the same command | the `written …` lines |
| D3 | Deprioritisation (criterion 5): the noshow instance in the foreground (it logs, never shows), then the same instance in Doze; compare with `doze` on `s7-api33` | `… run-state --state foreground --app noshow --serial <noshow serial> --install <noshow id>`; then `--state doze --app noshow …` | the `written …` lines |
| D4 | Pending limit (criterion 6): 120 non-collapsible messages offline, then the collapsed variant | `… run-state --state pending-limit …`; `… run-state --state pending-limit-collapsed …` | the `written …` lines; what the tray and the inbox show after reconnect |
| D5 | Key-leak check, then Claude commits the runs | `pnpm --filter @shifa-spike/s7-sender check:secrets` | "ok" |

## E. One-day run (criterion 7)

| # | Step | Command | Send back |
|---|---|---|---|
| E1 | **(yes)** Pick the day; keep the machine awake and on power from 07:50 to 21:10; start both emulators `s7-api33` and `s7-latest` and the receiver | — | the date |
| E2 | Start the day run before 08:00 (it waits for 08:00, sends every 15 minutes to both, forces Doze between sends) | `pnpm --filter @shifa-spike/s7-scenarios run-day --target <serial33>=<id33> --target <serialLatest>=<idLatest>` | the final `written …` lines and `missed slots: n` |
| E3 | The machine's network (fibre, ADSL, mobile hotspot, VPN or not) and its country | — | as you state them |
| E4 | Aggregated Delivery Data (it lags up to 5 days; an empty answer is recorded as such), with your own `gcloud` login, not the sender key | `curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" "https://fcmdata.googleapis.com/v1beta1/projects/<project number>/androidApps/<android app id>/deliveryData"` | the JSON (it holds counts only) |

## After the result (checkpoint F)
- Claude runs the analysis (`pnpm --filter @shifa-spike/s7-analysis analyse`), writes the report and ADR-0038.
- **(yes)** The owner removes both spike Android apps from the Firebase project and deletes the `s7-push-sender` service account (and its key file); the date goes in the report.
