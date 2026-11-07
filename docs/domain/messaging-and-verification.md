# Messaging and Phone Verification

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-10, RN-03, RN-06, RN-16, RN-17

Purpose: defines how Shifa reaches patients and staff, and how patients prove they own a phone number, under the owner's decisions:
- **no SMS at all**;
- **FCM push (owner-confirmed working in Syria and Azaz) plus an in-app inbox** as the primary channel;
- **WhatsApp through a self-hosted unofficial gateway** as a secondary channel.

The official WhatsApp Business Platform is not available for Syria [RN-10 §2] [RN-03]. Built in **Phase A**.

Related: [patient app](patient-app.md) · [scheduling and queue](scheduling-queue.md) · [voice calling](voice-calling.md) · [platform](platform-and-configuration.md) · [open decisions](../open-decisions.md)

## 1. Honest risk statement

WhatsApp's Terms of Service forbid automated and unofficial clients. Linking an unofficial client can lead to a temporary or permanent ban of the number. Since late 2025 WhatsApp has also capped messages to contacts who do not reply (gateway errors 463/475) [RN-10 §2].

The realistic risk is **losing a clinic's or the platform's number**, not legal action. Therefore:
- nothing critical depends on WhatsApp alone;
- every WhatsApp message also exists in the app inbox or as a staff task;
- clinic owners sign a written risk acknowledgement before linking a number.

## 2. Channels (ADR-0017)

- MSG-01 The channel order for each patient event is:
  1. a record in the in-app inbox;
  2. an FCM push (visible, high priority, collapsed per appointment);
  3. WhatsApp from the clinic's session, only if the patient opted in;
  4. if WhatsApp fails or the session is down, a "send manually" task for the receptionist.
- MSG-02 Patients without the app get WhatsApp if they opted in. Otherwise they get the manual task, or appear on a phone-call list.
- MSG-03 Release 1 has five message types: booking confirmed/changed/cancelled, reminder (24 h, optional 2 h), bulk delay notice, turn near / you are called (push only), and follow-up reminder (for example cast removal or an installment due).
- MSG-04 Staff get in-dashboard notifications for new online bookings, cancellations, booking requests and WhatsApp session problems.
- MSG-05 SMS is not used in any flow. The interface keeps room for one if the decision ever changes.
- MSG-06 Email (Later; for staff only).

## 3. WhatsApp gateway

- MSG-07 The gateway is WAHA, self-hosted, pinned to a 2026.x version, running the GOWS engine with NOWEB as fallback. It uses Postgres storage, API-key auth and a private network only [RN-10 §1, §7]. Confirm WAHA's code licence before committing (unverified).
- MSG-08 Each clinic links its own **WhatsApp Business app** number by scanning a QR code on a clinic-admin page. Onboarding states the rules:
  - use a dedicated phone, kept online at least every ~14 days;
  - link at most 3 other devices;
  - complete the business profile.
- MSG-09 The platform uses a separate number, in its own container, only for phone verification (§5).
- MSG-10 Clinic sessions are sharded across containers, starting at about 20–50 per container (an estimate, to be validated by load test).
- MSG-11 All sending goes through one internal interface, `sendWhatsApp(clinicId, patientId, templateKey, vars)`. WAHA can then be swapped for Baileys, Evolution, or the official Cloud API for +90 numbers through a Turkish entity, without changing business logic (OD-12).
- MSG-12 Inbound messages are matched by phone number. Senders shown as `@lid` are resolved to phone numbers before any matching.

## 4. Responsible-use controls (ban-risk reduction)

- MSG-13 The clinic's WhatsApp is used only to message patients who opted in. A patient opts in by messaging the clinic number first, through a `wa.me` link or a QR code on the ticket, receipt or booking page. The last inbound message time is stored per patient per clinic [RN-10 §3].
- MSG-14 A patient opts out by sending "إيقاف" or "STOP". The opt-out is honoured immediately and stored.
- MSG-15 Sending controls for each session:
  - a FIFO queue with one send at a time;
  - a random 20–60 s gap between messages;
  - a typing simulation;
  - an hourly cap that starts at about 30 per number;
  - quiet hours from 21:00 to 08:00;
  - 3–5 wording variants per template, with personalisation.

  All numbers are estimates to validate in a 2–3 clinic pilot (OD-12).
- MSG-16 Circuit breaker: on error 463/475 or any warning, the session stops sending for 24 h. Pending messages are routed to fallbacks and the clinic admin is alerted. The session is never re-paired automatically.
- MSG-17 A health job runs every 5 minutes. It flags unlinked sessions and warns the clinic when the linked phone has not been seen for about 10 days.
- MSG-18 Delivered and read acknowledgements show as ticks in the staff UI.
- MSG-19 Clinics can edit message templates in Arabic using fixed placeholders (patient name, date, doctor, clinic). Free-form bulk marketing is not allowed.

## 5. Phone verification (no SMS) (ADR-0016)

- MSG-20 **Primary: reverse WhatsApp verification.**
  1. The app requests a nonce, valid for 10 minutes and bound to the device.
  2. It opens `wa.me/<platform number>?text=<code + short phrase>`.
  3. The patient sends that message.
  4. The backend matches the nonce to the sender's number, then confirms to the app over a websocket or FCM and replies "verified" in the same chat.

  Because the user messages first, this adds little ban risk [RN-10 §5].
- MSG-21 **Fallback: verification at the reception desk.** Staff open the patient's "claim" QR in the clinic dashboard, check the patient's identity and mark the phone verified. This is the recommended path for elderly patients.
- MSG-22 Shifa never sends verification codes outward to new numbers from the platform WhatsApp number. That is the riskiest pattern.
- MSG-23 Telegram Gateway is an optional future fallback (Later). Adopt it only after confirming delivery to +963 and +90 numbers and a feasible way to fund it.
- MSG-24 Sessions:
  - refresh tokens are bound to the device;
  - a new device requires verifying again;
  - attempts are rate-limited per device and per number;
  - account recovery is done with staff assistance.
- MSG-25 One verified phone can hold several family profiles (see [patient app](patient-app.md)). Moving a dependent to their own phone requires verifying that phone.

## 6. Push reliability (FCM)

- MSG-26 The app has its own high-importance notification channel, "مواعيد". It asks for notification permission after the first booking (Android 13+) and reports the permission state to the backend.
- MSG-27 Every high-priority message must show a visible notification. Otherwise FCM deprioritises the app [RN-10 §6].
- MSG-28 The app shows an Arabic battery-optimisation guide for each phone brand (Samsung, Xiaomi/Redmi/POCO, Oppo/Realme, Tecno/Infinix, Huawei). It never requests a battery-optimisation exemption directly, because Play policy forbids it.
- MSG-29 Every send carries an `analyticsLabel`. FCM's aggregated delivery data is reviewed weekly.
- MSG-30 Live queue tracking also works over a websocket or polling while the app is open, so it does not depend on push.
- MSG-31 Huawei Push Kit, for devices without Google services (Later; only if data shows it matters).

## Key entities

- `notification`: inbox record per recipient, with event type, payload and read state.
- `delivery_attempt`: channel, status, error code, timestamps.
- `whatsapp_session`: clinic, number, engine, container shard, state, last seen, breaker state.
- `whatsapp_optin`: (clinic, patient) last inbound time, opt-out flag.
- `message_template`: key, language, variants, placeholders.
- `manual_send_task`: receptionist fallback item with a pre-filled `wa.me` link.
- `phone_verification`: nonce, device, method (reverse WhatsApp / reception), status, expiry.
- `device`: FCM token, platform, notification permission state.

## Verification notes

- Throttling tests with fake timers check that per-session sends respect the gap, the hourly cap and quiet hours, and that no two sends from one session overlap.
- A circuit-breaker test injects a 463 error, then checks that the session pauses for 24 h, pending messages move to the inbox and manual tasks, and the admin is alerted.
- An opt-in/opt-out test checks that no WhatsApp message goes to a patient without an inbound record, and that an opt-out is honoured within one message.
- Reverse-verification tests:
  - a correct nonce and sender verify;
  - an expired nonce, a wrong device or a mismatched sender fail;
  - an `@lid` sender is resolved.
- A fallback test kills the gateway and checks that every event still reaches the inbox and creates a manual task.
- A pilot runs for 4–6 weeks with 2–3 clinics and tracks bans and warnings per number before WhatsApp is rolled out more widely (OD-12).
