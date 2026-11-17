# Spike 0.3-S5 — manual WhatsApp day (owner checklist)

Criterion 11 of [spec 0.3-S5](../specs/spikes/0.3-s5-whatsapp.md), prepared in [0.3-S5b](../slices/0.3-s5b-whatsapp-verification-and-tooling.md), run in [0.3-S5c](../slices/0.3-s5c-whatsapp-manual-day-and-result.md). One day, small volume, two numbers the owner owns (OD-45): **G** (WhatsApp Business app on its own phone, the gateway number) and **P** (the patient phone). Never the owner's personal number or a clinic's number. CI never touches real WhatsApp.

## Rules for the day
- The QR equals account takeover: show it only on the local admin page, scan it at once, never photograph, screenshot or paste it.
- Do not paste numbers, codes, QR values or message texts into chat, issues, commits or the report. Record only times, states and error codes.
- Raw webhook bodies go only to the git-ignored `.cache/s5/raw/`; the scrub (step 16) deletes them.
- Stop the run and write down the time and error code at the first 463, 475 or capping warning (the breaker pauses the session; do not resume that day unless the step says so).

## Setup (once)
1. Create `spikes/s5-whatsapp/.env.local` (git-ignored by `.env.*`; never commit it; empty values count as unset):

   | Variable | Value |
   |---|---|
   | `S5_NUMBER_G`, `S5_NUMBER_P` | the two numbers in E.164 (`+90…` or `+963…`); they form the allowlist (MSG-32) |
   | `S5_DATABASE_URL` | the spike database of the run stack (0.3-S5c) |
   | `S5_WAHA_PLATFORM_URL`, `S5_WAHA_PLATFORM_API_KEY`, `S5_WAHA_PLATFORM_HMAC_KEY` | the `platform` WAHA container (0.3-S5c prints them) |
   | `S5_WAHA_CLINICS_URL`, `S5_WAHA_CLINICS_API_KEY`, `S5_WAHA_CLINICS_HMAC_KEY` | the `clinics` WAHA container |
   | `S5_ADMIN_TOKEN`, `S5_VERIFY_KEY` | two random strings of 32+ characters |
   | `S5_LISTEN_HOST`, `S5_LISTEN_PORT`, `S5_ADMIN_PORT` | where WAHA posts webhooks (the address its containers reach, never `0.0.0.0`); defaults `127.0.0.1`, 3105, 3106 |
   | `S5_CAP_PER_HOUR` | optional, default 30 (OD-46) |
2. Start the service: `node spikes/s5-whatsapp/messaging/scripts/manual-run.ts serve` (it registers P as the run's one patient). Open the printed **admin page** link (it carries the page token after `#`) in a browser on the same machine.

## Steps

| # | Step | Expected | Time | Result / error code |
|---|---|---|---|---|
| 1 | Admin page: **تشغيل** on `platform` (the first start creates the session in WAHA), then **QR**; scan it with G's WhatsApp Business app (Linked devices) | `platform` turns `WORKING` / `linked`; QR disappears after a minute | | |
| 2 | `node spikes/s5-whatsapp/messaging/scripts/device.ts`; open the printed link on P and send the message **as it is** | P's chat gets one reply **تم التحقق…**; the script prints `{"status":"verified"}`; admin page: `verified: 1` | | |
| 3 | Run the script again; on P type the message by hand: a word before it, the phrase `رمز التحقق في شفاء:`, the code with its digits in Arabic-Indic (e.g. `٧K…`), a word after it | verified again, one reply. Then send only the code from a new nonce, without the phrase: no reply, the script keeps polling | | |
| 4 | Run the script again; wait 11 minutes, then send the message from P | no reply; the script prints `{"status":"expired"}`; admin page: `expired: 1` (a code from a third number is covered by the automated suites: G cannot write to itself and there is no third number) | | |
| 5 | Send `مرحبا` to G from P (no code) | no reply from the platform | | |
| 6 | Admin page: **إيقاف** on `platform`; on G's phone unlink the device. **تشغيل** on `clinic-g`, **QR**, scan with G | `clinic-g` `WORKING`; `platform` not linked | | |
| 7 | P sends `مرحبا` to G (opt-in; `serve` registered P as the run's patient at start) | admin page, الاشتراك: `c-run: مشترك`; nothing sent | | |
| 8 | `node spikes/s5-whatsapp/messaging/scripts/manual-run.ts batch 30` (repeat later in the day for 20–40 in total) | prints `{"queued":30}`; messages arrive on P with 20–60 s gaps, seen and typing before each, never more than the cap in a rolling hour, none between 21:00 and 08:00 | | |
| 9 | Watch acks: P reads some messages | delivery attempts move to `delivered` / `read` on the admin page | | |
| 10 | P sends `إيقاف` | one confirmation; queued messages dropped; `batch 2` then prints `refused:opted_out` | | |
| 11 | P sends a normal message, then `batch 2` | opted in again; the two messages arrive | | |
| 12 | Restart the `clinics` WAHA container (0.3-S5c gives the command) | `clinic-g` back to `WORKING` **without** a new QR; record the time to resume | | |
| 13 | Turn G's phone off (or flight mode) for one hour while `batch 5` runs | record what arrives on P and the session state; G back on: anything stuck? | | |
| 14 | Unlink G on the phone; then re-link with a new QR | unlink: session leaves `WORKING`, a row under التنبيهات; re-link: `WORKING` | | |
| 15 | Before the scrub: search both WAHA containers' logs for G and P (with and without `+`, and their last 7 digits) and the codes of steps 2–4 (the QR value is never copied, so there is nothing to search for). Commands in 0.3-S5c | 0 matches each | | |
| 16 | `node spikes/s5-whatsapp/messaging/scripts/scrub-fixtures.ts` | prints `scrubbed N captures`, exits 0; `.cache/s5/raw/` empty; fixtures in `spikes/s5-whatsapp/fixtures/` | | |
| 17 | Before committing: open every fixture and read it. Only placeholders (`text-N`, `9639300…` numbers) and WAHA field values may appear; no name, place, link or number you recognise | nothing personal; if in doubt, delete that fixture | | |

## Warnings and errors seen
Write every 463, 475, capping warning (`FIRST_WARNING`, `SECOND_WARNING`, `CAPPED`), `FAILED`/`STOPPED` and timeout with its time. Leave empty if none.

| Time | Session | Code or state | What was happening |
|---|---|---|---|
| | | | |
