# ADR-0017: Notifications — push + in-app inbox primary; WhatsApp via self-hosted WAHA as secondary channel

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The owner decided to use an unofficial WhatsApp library with ban-risk minimisation (official API unavailable for Syria), no SMS, and Firebase (confirmed working in Syria and Azaz by the owner). WhatsApp's terms forbid automated unofficial clients and bans are the realistic risk [RN-10 §2]. Among gateways, WAHA's free image includes unlimited sessions since 2026.6.1 and runs a Go engine without a browser; Baileys v7 is still RC; Evolution API requires licence-server activation; browser-based libraries cost 200–500 MB per session [RN-10 §1].

## Decision
- Channel ladder per event: in-app inbox record → FCM push (own high-importance channel, Android 13+ permission, per-brand battery guides) → WhatsApp from the clinic's own linked number if the patient opted in → if WhatsApp fails or the session is down, a "send manually" task for the receptionist that opens `wa.me` with the prepared text. Critical paths never depend on WhatsApp.
- Gateway: self-hosted WAHA (pinned 2026.x, GOWS engine, NOWEB fallback), Postgres session storage, private network, API key. One platform number for verification ([ADR-0016](0016-identity-better-auth-reverse-whatsapp.md)); each clinic links its own WhatsApp Business number by QR after a written risk acknowledgement.
- Responsible use: send only to patients who messaged the clinic first or opted in (QR/link at registration); opt-out keyword; per-number FIFO with randomised spacing and hourly caps; quiet hours 21:00–08:00; template variants; circuit breaker that pauses a number for 24 h on warnings (error codes 463/475) and alerts the clinic; health checks and "phone not seen" reminders. Numeric thresholds are pilot-validated (OD-12).
- The gateway sits behind an internal `sendWhatsApp(clinicId, patientId, templateKey, vars)` interface so it can be swapped (Baileys, Evolution, or the official Cloud API for +90 numbers via a Türkiye entity — OD-12).
- No SMS.

## Consequences
+ Patients receive messages on the channel they use; the product survives a WhatsApp ban.
− ToS risk remains and is accepted by the owner; clinics are informed in writing.
− WAHA's code licence must be verified before production (unverified).

## Alternatives considered
- Official WhatsApp Cloud API: Syria ineligible (Meta page updated Nov 2025) [RN-10 §2].
- SMS gateways: rejected by the owner.
- Baileys directly, Evolution API, whatsapp-web.js/WPPConnect: see Context [RN-10 §1].

## Sources
[RN-10 §1–§7], [RN-06 §5], [RN-03 §3]
