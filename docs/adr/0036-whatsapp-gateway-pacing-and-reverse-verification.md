# ADR-0036: WhatsApp gateway, pacing and reverse verification — WAHA GOWS with PostgreSQL storage, one container per role, signed webhooks matched by message key, pg-boss pacing, admin-confirmed breaker, phrase-bound codes

Status: Accepted (owner, 2026-11-20) · Date: 2026-11-20 · Deciders: product owner (with Claude) · Amends: [ADR-0016](0016-identity-better-auth-reverse-whatsapp.md), [ADR-0017](0017-notifications-push-whatsapp.md)

## Context
[ADR-0017](0017-notifications-push-whatsapp.md) chose self-hosted WAHA (GOWS, NOWEB fallback) behind `sendWhatsApp(...)` as the secondary channel, with opt-in, pacing, quiet hours and a breaker; [ADR-0016](0016-identity-better-auth-reverse-whatsapp.md) chose reverse WhatsApp codes for patient phone verification. Neither had been run. Spike S5 ([spec](../specs/spikes/0.3-s5-whatsapp.md), [result](../spikes/s5-whatsapp.md)) built that layer as throwaway code against a fake WAHA, then ran it on real WhatsApp for one day with two numbers the owner owns (OD-45). The real run found what the fake had wrong: every one-to-one inbound chat is an `@lid`, acks name the `@lid` chat while the send returned `<phone>@c.us`, an unlinked session is `FAILED` and needs a stop before a start. The rules below are what Phase A must meet; numeric thresholds stay with the OD-12 pilot.

## Decision
**Gateway, engine and storage**
- WAHA Core, GOWS build, pinned by version and digest (spike: `gows-2026.10.1`), unmodified and reached only over HTTP. NOWEB stays an emergency fallback: switching engines needs a new QR for every number.
- **Before the pilot**, devlikeapro confirms in writing that a multi-tenant SaaS may run the Core GOWS image (the image says `UNLICENSED`, the GOWS binary carries no licence). Phase A development does not wait for it.
- PostgreSQL session storage, one WAHA namespace and one database role per container; WAHA's PostgreSQL is not the product database. Sessions resume after restarts without a QR (measured 7–9 s).
- **One container for the platform role, separate containers for clinics** (MSG-09, MSG-10); the platform session never shares a container or a session with a clinic. Start at 10 clinic sessions per container with a 2 GiB limit (estimate from one session) and raise it only on pilot measurements.
- No published port; API key per container; hardening from the backlog (capabilities dropped, read-only root, limits, separate PostgreSQL or revoked `CONNECT` between WAHA roles) before real clinics.
- A clinic's gateway number is used for nothing else; onboarding says so and shows the risk acknowledgement (ADR-0017).

**Webhooks and routing**
- Each container posts to its own path with its own HMAC key (HMAC-SHA512 over the raw body, `X-Webhook-Hmac`); unsigned or wrongly signed bodies are refused before any parsing, a session the posting container does not own is refused, exact replays are dropped. Phase A adds a freshness window on the signed `timestamp` (backlog).
- The role comes from (container, session) only: platform messages go to verification only, clinic messages to that clinic's opt-in only.
- **Every inbound sender is resolved from `@lid` to a phone** through WAHA's LID lookup before matching; a lookup that fails (timeout, 5xx) answers 503 so WAHA retries; "no phone" fails closed. Groups, broadcasts, newsletters and `fromMe` events are dropped before any processing or capture.
- **Acks are matched by the message key** (the part after the chat in `true_<chat>_<key>`) within the session, never by the full id, only for our own sends (`true_`), and only move forward; Phase A stores the key in its own indexed column.
- The webhook parsers live in one pure module, and the captured, scrubbed fixtures replay through it against the fake in CI; the fake follows the real shapes (`me` with `lid`, `jid` and the capping block, `null` while not linked, and so on).

**Queue, pacing and sending**
- **pg-boss** (ADR-0003), one queue per WhatsApp session, one send at a time; no Valkey. All sends go through `sendWhatsApp(clinicId, patientId, templateKey, vars)`; outside production only allowlisted numbers receive anything.
- Before each send: seen, typing for a time that grows with the length, then the send. Random gap 20–60 s; a cap per rolling 60 minutes (default 30, OD-46, pilot-tuned by OD-12); quiet hours 21:00–08:00 in the clinic's time zone with deferred sends spread after 08:00; one of 3–5 wording variants.
- Opt-in: a send to a patient who never wrote to the clinic is refused before it is queued. Opt-out keywords (`إيقاف`, `ايقاف`, `STOP`, normalised) take effect at once, drop the queue and send one confirmation; any other inbound opts back in.
- **At most once:** a send whose outcome is unknown after a timeout is never retried; it becomes a manual-send task marked "maybe sent".

**Breaker, faults and health**
- 463, 475 or a warning (`messageCapping.cappingStatus` other than `NONE` on `me` of **any** webhook or in `session.status` `data`; an active `reachoutTimelock`) pause the session for 24 h, move every pending message to the inbox plus a manual-send task with a `wa.me` link, and alert the clinic admin once. After 24 h the session stays paused until the clinic admin confirms (OD-46). The service never re-pairs, restarts or logs out a session on its own.
- Gateway down, timeouts and `FAILED`/`STOPPED` take the same fallback without the 24 h pause; sending resumes at `WORKING`.
- The health job maps WAHA states every 5 minutes (a session the container does not know is `STOPPED`) and alerts on transitions into `needs_qr` and `down`. GOWS gave no explicit "phone not seen" signal in 24 minutes offline (the session stayed `WORKING` and sends succeeded); only acks stopped. So the 10-day warning counts from the **last delivered or read ack or the last inbound message, never from the last send**, and a session with sends but no ack for several hours gets an early warning (the hours are set in the pilot).
- Starting a `FAILED` session stops it first (a bare start leaves it `FAILED`).
- The service backs off and alerts when its database is gone, instead of spinning (backlog).

**Reverse verification (amends ADR-0016)**
- The device requests a nonce (10 minutes, bound to the device, a device secret and the claimed number) and opens `wa.me/<platform number>?text=<phrase> <code>`. Code: 6 characters from a 31-symbol alphabet without look-alikes, stored as an HMAC under a server key, single use.
- **A code counts only right after the fixed phrase** (`رمز التحقق في شفاء:`), folded for case, Arabic-Indic digits and tashkeel; extra words around it pass, a bare code or a disguised message never verifies. Proven on real WhatsApp with a hand-typed message.
- The sender's resolved phone must equal the claimed number; expired, reused, wrong-device and third-number codes fail. Limits: 5 nonce requests and 5 failed matches per device and per number per hour; a refused retry does not extend the lock. Phase A replaces the per-number failure count with one that a stranger cannot use to lock a victim out (backlog).
- **The platform number never initiates:** its only send is one reply to a successful match, in the same chat (`@lid` stays `@lid`), quoting the message, naming the action and telling a patient who did not ask to contact the clinic. A valid code from a number not on the allowlist verifies without a reply outside production.
- Forwarded-link risk (an attacker's nonce sent from the victim's phone) is reduced, not removed: Phase A shows the verified device and time in the patient app and lets the patient revoke it.

**Data handling**
- No phone number, message body, code, QR value, key or HMAC secret in logs; the QR is shown only to the clinic admin and never stored. WAHA's own logs go through the Collector's redaction (they name other people's `@lid` ids).
- Captures for new fixtures only in a manual run, outside the repository tree, scrubbed to placeholders and checked before commit.

**Confirmed by the owner on acceptance (2026-11-20)**, beyond what the spike measured: start at 10 sessions per container; drop group, newsletter and `fromMe` events before any processing or capture; WAHA's logs go through the Collector's redaction.

## Consequences
+ Phase A builds on a layer that has met real WhatsApp: verification, opt-in and opt-out, pacing under the cap, acks and recovery all worked with the owner's numbers.
+ The fake and the fixture replay keep automated tests honest without touching WhatsApp in CI.
+ The linked device keeps sending while the clinic's phone is offline; only acks wait.
− Unofficial client: ToS risk and bans remain (ADR-0017); thresholds are unknown until the pilot (OD-12).
− The GOWS licence is unconfirmed; the pilot waits for written confirmation.
− Every inbound message costs a LID lookup; WAHA must be up for any inbound to be processed (retries cover short outages).
− A clinic must dedicate a phone and a number to the gateway.

## Alternatives considered
- **NOWEB as the main engine:** not needed; GOWS covered seen, typing, acks and events. Kept as a fallback at the cost of a re-link.
- **Valkey or BullMQ for pacing:** pg-boss held per-session pacing and the cap with no extra service.
- **Matching acks by full id:** fails on real WhatsApp (`@lid` vs `@c.us`).
- **Automatic resumption after a warning pause:** rejected (OD-46); a standing warning risks a ban.
- **Codes without the phrase:** a disguised message ("confirm my appointment K7Q4MX") could verify a victim; rejected in the 0.3-S5b security review.
- **Official Cloud API for +90 numbers:** out of scope (OD-45, OD-12).

## Sources
[Spike S5 result](../spikes/s5-whatsapp.md), [manual-day checklist](../spikes/s5-manual-checklist.md), [RN-10 §1–§7], OD-12, OD-45, OD-46
