# Spike S5 result: WhatsApp through WAHA (GOWS), pacing, opt-in and reverse verification

Date: 2026-11-17 to 2026-11-20 (automated suites); manual day 2026-11-18 17:40 to 2026-11-19 20:43 UTC · Spec: [0.3-S5](../specs/spikes/0.3-s5-whatsapp.md) · Slices: [0.3-S5a](../slices/0.3-s5a-whatsapp-stack-and-sending.md), [0.3-S5b](../slices/0.3-s5b-whatsapp-verification-and-tooling.md), [0.3-S5c](../slices/0.3-s5c-whatsapp-manual-day-and-result.md) · Decision: [ADR-0036](../adr/0036-whatsapp-gateway-pacing-and-reverse-verification.md) (Accepted, owner 2026-11-20), amending [ADR-0016](../adr/0016-identity-better-auth-reverse-whatsapp.md) and [ADR-0017](../adr/0017-notifications-push-whatsapp.md) · Checklist with every time and state: [s5-manual-checklist.md](s5-manual-checklist.md) · Open: OD-12 (pilot thresholds)

## Answer
**WAHA's free image with the GOWS engine and PostgreSQL session storage is fit for Phase A as the secondary channel, behind our own layer.** On real WhatsApp, with the owner's two numbers, reverse verification, opt-in and opt-out, paced sending under the hourly cap, acks, a restart without a new QR and an unlink/re-link all worked once three defects were fixed that only real traffic showed. Two things stay open: the licence of the GOWS binary must be confirmed in writing before the pilot (it does not block Phase A development), and ban thresholds still need the OD-12 pilot.

What only the real run showed (the fake was wrong on each, and is now fixed and checked against the captures):
- **Every one-to-one inbound chat arrives as `@lid`.** All 143 direct messages (P's and those of 11 other people who wrote to G) named an `@lid` chat; none named `<phone>@c.us` (groups and newsletters came as `@g.us` and `@newsletter`). Without the LID lookup nothing would be matched. The lookup resolved P every time (verification, opt-in, opt-out, opt-in again).
- **Acks name the `@lid` chat, the send returned `@c.us`.** `sendText` answered `true_<phone>@c.us_<key>`; its acks came as `true_<lid>@lid_<key>`. Matching by the full id left every attempt at `sent`. Matching by the message key fixed it (live from 19:22 UTC on day 2).
- **A session unlinked on the phone is `FAILED`, and a start leaves it `FAILED`.** It needs a stop first; the admin page now does that.
- **A session the container does not know showed as `WORKING`** on the admin page (the column's default); the health job now records `STOPPED`.
- **The linked device sends while the phone is offline; only acks wait.** WAHA stayed `WORKING` for the whole 24 minutes and gave no explicit "phone not seen" signal; the only signal was ack silence (no `DEVICE`/`READ` ack until G came back). A health warning based on the last successful send would never fire for a clinic whose phone is off while reminders go out.

## Versions tested
WAHA 2026.10.1 GOWS build (`devlikeapro/waha:gows-2026.10.1@sha256:1f7faeb0…`), Core tier · PostgreSQL 18.6 (`postgres:18.6-trixie@sha256:e3d24f69…`) for WAHA's session storage and, separately, for the spike's state · pg-boss 12.38.2 · Fastify 5.12.8 · Node 24.21 (host) · Docker Desktop 29.2.1 on Windows 11 Pro 26200, Intel Core i9-14900HX, 32 GB. Phones: G with the WhatsApp Business app (gateway number, Syrian), P with WhatsApp (patient phone, Syrian), both owned by the owner (OD-45).

## Evidence per criterion
Automated suites run on the fake gateway (`spikes/s5-whatsapp/*/test/`, `pnpm test:spike` in each package, manual CI workflow `s5-whatsapp`): fake-waha 9 tests, messaging 108, stack 12, all green on 2026-11-20.

| # | Result | Proof |
|---|---|---|
| 1 | Images pinned by digest; WAHA has no published port in the test stack; unsigned and wrongly signed webhooks get 401. Real run: all 489 captured webhooks carried `X-Webhook-Hmac` (sha512) and checked valid with the container's key | `stack/test/images.test.ts`, `waha-boundary.test.ts`, `messaging/test/webhook.test.ts`; fixtures' `signature` field, `fake-waha/test/fixture-replay.test.ts` |
| 2 | The fake serves the spike's endpoints and faults. Every committed capture and the fake's event of the same kind normalise to the same event through the service's parsers, and the fake's bodies have the real fields (shapes fixed on day 3, list below). Committed: 111 captures of `session.status` and of P's and G's traffic plus 4 example shapes with ids and times replaced (the other 374 captures were other people's and were deleted, see deviations). The replay builds the fake's twin from its event builders, not by driving the fake's state machine (backlog) | `fake-waha/test/fixture-replay.test.ts` (locked), `messaging/src/normalise.ts` |
| 3 | One send interface; allowlist outside production. Real run: 43 send attempts, every one to P; nothing reached anyone else | `allowlist.test.ts`; database check 2026-11-19 |
| 4 | Opt-in on inbound, `إيقاف` opts out at once, one confirmation, queue dropped, opt-in again on a normal message. Real run: steps 7, 10, 11 (all from `@lid` chats) | `optin.test.ts`; checklist steps 7, 10, 11 |
| 5 | Pacing: gap, seen and typing, rolling-hour cap, quiet hours, variants; 200-message simulated day; two containers do not block each other. Real run: 36 sends, gaps 20.8–59.1 s; the cap of 30 deferred the 31st send to the next window (step 11) | `scheduler-day.test.ts`, `queue*.test.ts`; checklist steps 8, 11 |
| 6 | Breaker on 463/475/warnings with 24 h pause and admin resume; faults take the fallback without the pause; a timed-out send is never retried. Real run: no 463, 475 or warning was seen | `breaker.test.ts`, `warnings.test.ts`; checklist "Warnings" table |
| 7 | Health maps states and alerts. Real run: unlink → `FAILED` webhook and alert in the same second; QR needed → `health:needs_qr`. **no explicit "phone not seen" signal in 24 minutes; ack silence is the usable proxy**, so the 10-day warning must count from the last ack received or the last inbound, never from the last send (ADR-0036; the spike's job still uses the last send) | `health.test.ts`, `manual-day-fixes.test.ts`; checklist steps 13, 14 |
| 8 | Acks forward-only. Real run: `delivered` and `read` after the key-matching fix | `acks.test.ts`, `manual-day-fixes.test.ts`; checklist step 9 |
| 9 | Reverse verification on the fake (expired, wrong device, mismatch, reuse, third number, rate limits, platform never initiates). Real run: link as sent, typed by hand with Arabic-Indic digits and words around it, code alone (ignored), expired code (no reply), plain message (no reply) | `verify.test.ts`, `platform-never-initiates.test.ts`; checklist steps 2–5 |
| 10 | Tenant and role separation by container and session; foreign session refused | `separation.test.ts`, `webhook.test.ts` |
| 11 | All 17 checklist steps run; deviations below | [checklist](s5-manual-checklist.md) |
| 12 | Measurements below | checklist; `run-stack.ts status` |
| 13 | This report, ADR-0036, OD-12 evidence | — |

## Answers to the spec's questions

### Licence (WAHA image and GOWS)
- The public repository `devlikeapro/waha` (WAHA Core) is listed as **Apache-2.0**.
- Inside the pinned image `/app/package.json` says `"license": "UNLICENSED"`, there is no WAHA licence file, and the GOWS engine ships as the binary `/app/gows` with no licence next to it (checked 2026-11-17, `stack/src/images.ts`). GOWS builds on whatsmeow (an MPL-2.0 Go library; not verified in this spike).
- Third-party pages disagree on whether GOWS is a Core feature or a Plus feature; the pinned `gows-` Core image ran it without a key.
- **Verdict:** unclear from the image alone. It does not block Phase A development, but the pilot must not start until devlikeapro confirms in writing that a multi-tenant SaaS may run the Core GOWS image (ADR-0036). Running WAHA unmodified and only over HTTP keeps us clear of copyleft obligations either way.

### Restart survival and what forces a new QR
- `docker restart` of the `clinics` container: `WORKING` again 7.3 s after the command, no QR.
- Docker Desktop stopped overnight (unplanned, ~23 h): after `docker start` the session went `STARTING` → `WORKING` in about 9 s, no QR.
- A new QR was needed only after G logged the device out on the phone (step 14), which WAHA reports at once as `FAILED` with `data.reason.event: LoggedOut`.
- Not tested: WhatsApp's 14-day limit for a linked device whose phone stays offline.

### `@lid` senders
- One-to-one chats (143 direct messages: P and 11 other people who wrote to G) all came from `@lid`; group (10) and newsletter (23) messages from `@g.us` and `@newsletter`; none from `@c.us`.
- WAHA's `GET /api/{session}/lids/{lid}` resolved P every time. A failed lookup (timeout, 5xx) is answered 503 so WAHA retries the webhook; "no phone number" fails closed.
- Acks of our own sends name the recipient's `@lid` chat but keep the send's message key: match acks by key.

### GOWS coverage and NOWEB
- **Seen, typing, send:** every one of the 36 real sends went out after `sendSeen`, `startTyping` and `stopTyping` all answered OK (a failed call stops the send).
- **Acks:** `DEVICE`, `READ` and `PLAYED` seen; no `ERROR` ack, so the reordering risk of backlog item N7 was not observed.
- **Events:** `message`, `message.ack`, `message.reaction`, `message.revoked`, `session.status` all arrived; no `message.edited` was produced.
- **NOWEB:** not run. Switching engine means a new session and a new QR for every number (sessions are stored per engine); keep it as an emergency fallback only.

### pg-boss or Valkey
pg-boss is enough. One queue per session paced the real sends (one at a time, 20.8–59.1 s), held the cap and dropped the queue on opt-out; the 200-message simulated day and the two-container test pass. Nothing in the run asked for Valkey.

### Warning signals
- Every webhook's `me` carries `messageCapping` (`cappingStatus`, quota, cycle) and `reachoutTimelock`; `session.status` on `WORKING` also carries `messageCapping` in `payload.data`. The breaker now reads both places.
- During the run: `cappingStatus: NONE`, `totalQuota: -1`, `reachoutTimelock: null` on every event. No 463, 475, `FIRST_WARNING`, `SECOND_WARNING` or `CAPPED`.
- The breaker now reads a warning on every webhook of the session (it read only `session.status` before the security review), so the platform sees it within seconds while there is traffic and at the next health run otherwise. How early before a ban that is, only the pilot can tell (OD-12).

### Sessions per container (estimate)
Measured with one session, so an estimate only: the WAHA container used 357–504 MiB with no live session at first start and 282 MiB with one live session (CPU near 0 idle, 1.5 % while sending). Memory did not grow measurably with one session. A start of **10 sessions per container with a 2 GiB limit** is a cautious estimate (MSG-10's 20–50 is not supported or refuted); measure per-session memory with 3–5 clinics in the pilot before raising it.

## Measurements (criterion 12)
| Measure | Value |
|---|---|
| WAHA memory, no live session (first start) | platform 504 MiB, clinics 357 MiB; CPU 0.01 % |
| WAHA memory, one live session (after the run) | clinics 282 MiB, CPU 1.5 %; platform (stopped) 353 MiB |
| PostgreSQL | WAHA's 101–128 MiB; spike state 50–55 MiB |
| Queue to first send | 5.0 s (batch queued 19:04:43.6, sent 19:04:48.6) |
| Gap between sends | 20.8–59.1 s over 32 gaps |
| Send → `delivered` ack, phone online | 0.37–1.29 s (n = 5, after the ack fix) |
| Send → `delivered` ack, G offline | 22–24 min: acks arrived when G came back |
| Code match → platform reply sent | 0.2–0.7 s |
| Restart → `WORKING` | 7.3 s (`docker restart`), ~9 s (`docker start` after 23 h) |
| Unlink → `FAILED` webhook and alert | same second |

## Fake fixes from the captures
The fake had: an envelope `metadata` field the real one lacks; `me` without `lid`, `jid` and the capping block, and `me` present while not linked (real: `null` in `STARTING` and `SCAN_QR_CODE`); inbound `to` set to our number (real: `null` outside groups) and `body` on every message (real: only on text); group ids without the `_<participant>` suffix; acks naming the `@c.us` chat; `session.status` `data` without capping or the logout reason; a start on `FAILED` that worked. All fixed; `fixture-replay.test.ts` fails on any new difference, listed by field name.

## Deviations from the plan
- **Quiet hours were off for the batches** (owner's choice on day 2 at 21:50 Damascus time, `S5_QUIET_HOURS=off`): quiet hours are proven by the `scheduler-day` suite only, not on real WhatsApp.
- **G was offline 24 minutes, not one hour** (owner could not power the phone off; Wi-Fi and data were turned off).
- **The day ran over two evenings** (an unplanned Docker stop in between), not one day.
- **The owner did not read every fixture** (step 17); they approved on the automated checks plus one sample of each event type. The security review then found 13 real group message keys the scrubber had missed (fixed, check strengthened) and the other people's traffic below; both were removed before the branch was published.
- **G is not fully dedicated:** it is also in groups and chats. 11 other people's direct messages (135), their read receipts of messages typed on G's phone, 10 group messages, 13 reactions, a revoke and 22 newsletter posts reached the webhook (never answered, never sent to). They were scrubbed into 374 fixtures, which were deleted before publishing on the owner's decision (2026-11-20); other people's LIDs also sat in the spike database (`platform_inbound`, `webhook_seen`) until the stack was removed.
- **The manual stack ran on a normal network** with WAHA and PostgreSQL ports published on `127.0.0.1` and webhooks to `host.docker.internal` (criterion 1's private network holds for the test stack only).
- **Step 15 searched the WAHA logs only;** the service's own output was searched afterwards (2026-11-20): 0 matches for both numbers and the five codes. The QR value was never copied, so there was nothing to search for.
- **Seen and typing on P** were not confirmed by eye.

## Risks left for the pilot
- **Ban thresholds** (OD-12): one day at ~40 messages tells nothing about bans; the pilot measures 4–6 weeks at about 30 per hour per number.
- **Per-number lockout** (backlog): failed matches count against the claimed number, so a stranger can lock a victim's number for an hour.
- **Forwarded link:** an attacker requests a nonce for the victim's number on the attacker's device and persuades the victim to open the link and press send; the victim's phone then verifies the attacker's device. The fixed phrase and the reply that names the action and says "contact the clinic if this was not you" make it harder, not impossible (ADR-0036); Phase A should also show the device and time in the patient app and let the patient revoke it.
- **Linked device offline for 14 days** unlinks it. Sends keep succeeding meanwhile, so the 10-day warning must count from the last ack or inbound (ADR-0036); the spike's health job still counts from the last send.
- **Other people's data on a shared number:** a gateway number must be dedicated; WAHA's warn log also names other people's `@lid` ids (backlog).
- **Service without its database** kept spinning for 23 h (750,000 log lines); Phase A needs backoff and a supervisor (backlog).
- **GOWS licence** (above).

## How to reproduce
- Suites: `pnpm --filter "@shifa-spike/s5-*" run test:spike` (Docker), or the manual `s5-whatsapp` workflow.
- Manual day: [checklist](s5-manual-checklist.md); stack with `node spikes/s5-whatsapp/stack/scripts/run-stack.ts up|status|restart|grep-logs|down`; service with `messaging/scripts/manual-run.ts serve`.
