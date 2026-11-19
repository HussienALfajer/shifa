# Spike 0.3-S7: push (FCM on Android)

Throwaway code for [spec 0.3-S7](../../docs/specs/spikes/0.3-s7-push.md). Slice
[0.3-S7a](../../docs/slices/0.3-s7a-push-probe-and-sender.md) built the parts below and proves
them with fakes; [0.3-S7b](../../docs/slices/0.3-s7b-push-runs-and-result.md) runs them against
the owner's Firebase project on emulators. Synthetic data only.

| Part | What it does |
|---|---|
| `receiver/` (`@shifa-spike/s7-receiver`) | `node:http` server on `127.0.0.1`: `POST /devices` (state report), `POST /receipts`, `GET /inbox?installId&since`, `GET /time`, `GET /queue`. Library API used by the sender: `writeInbox`, `markDead`, `isDead`. |
| `sender/` (`@shifa-spike/s7-sender`) | FCM HTTP v1 sender: service-account JWT (no Google SDK), inbox record before every send, send log, retries, dead tokens. `scripts/check-no-secrets.ts` is the key-leak check. |
| `scenarios/` (`@shifa-spike/s7-scenarios`, 0.3-S7b) | State matrix runner (`run --state <name> --serial <emulator> --install <installId> [--app noshow]`) and one-day runner (`day --target <serial>=<installId> ...`) over `adb`; a host-side watcher reads `dumpsys notification --noredact` every second and finds each shown push by its ticker (the s7id). Writes `runs/<date>-<state>-api<n>/`. |
| `analysis/` (`@shifa-spike/s7-analysis`, 0.3-S7b) | `pnpm analyse [--run <dir> ...]`: joins sends, shown, receipts and inbox per run; per-state table and the OD-52 pass mark in `runs/analysis.{md,json}`. |
| `probe/` (Flutter, standalone) | Android probe app `dev.shifa.spike.s7push` (flavor `compliant`) and `….noshow` (flavor `noshow`, criterion 5). |

## Files that must never be committed (ADR-0026)
All are git-ignored, also under the default names the Firebase and Cloud consoles and `flutterfire` give them (`*-firebase-adminsdk-*.json`, `<project>-<hash>.json`, per-flavor `google-services.json`, `firebase_options.dart`), and so are archives and dumps under the spike. The key-leak check fails if one is tracked; it runs in the sender's `lint`, so `pnpm verify` and PR CI run it.

| File | Holds |
|---|---|
| `probe/android/app/google-services.json` | the Firebase app config (from the Firebase console) |
| the service-account key, e.g. `service-account-s7.json` (best kept outside the repository) | the FCM sender's private key |
| `.env.local` | `S7_SERVICE_ACCOUNT_FILE=<path to the key>`; optional `S7_FCM_BASE_URL`, `S7_TOKEN_URL`, `S7_OUT_DIR` |
| `.out/` | `logs/` (inbox, receipts, requests, sends; scanned by the check) and `state/` (device registry with full tokens; never reported) |

Reports show a 12-character SHA-256 prefix of a token, never the token.

## Run (owner machine, 0.3-S7b)
1. Receiver: `pnpm --filter @shifa-spike/s7-receiver start` (port `S7_RECEIVER_PORT`, default 8787).
2. Probe on the emulator, from `probe/`:
   `node ../../../scripts/dart.mjs flutter run --flavor compliant --dart-define=S7_RECEIVER=http://10.0.2.2:8787`.
   Open it once: it creates the channels and reports its state. Tap "احجز موعداً" to be asked
   for notifications.
3. Send, from `sender/`:
   `pnpm send --kind reminder --appointment appt-1 --to all [--at <iso>] [--count 20] [--no-collapse] [--ttl-to <iso>]`.
   Kinds: `reminder`, `turn-near`, `call-in` (visible, high priority, channel "مواعيد") and
   `sync` (data-only, normal priority).
4. Before any commit: `node scripts/check-no-secrets.ts` from `sender/` (also in `pnpm verify`). It cannot read archives or files over 64 MiB and fails on them: split or summarise run logs.
5. `S7_FCM_BASE_URL` and `S7_TOKEN_URL` must be `https` (plain `http` only to `127.0.0.1`); a Google token is only ever sent to Google FCM. The probe's `S7_RECEIVER` must be `https` or `http` to `10.0.2.2`/`127.0.0.1`.

## Tests (no Firebase, no emulator)
- `pnpm run test:spike` in `receiver/` and `sender/` (fake FCM and fake token endpoint).
- `node ../../../scripts/dart.mjs flutter test` in `probe/` (fake push client, fake receiver).
- CI: the manual `s7-push` workflow runs all three and the key-leak check; it never calls FCM.
