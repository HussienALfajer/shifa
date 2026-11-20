# ADR-0038: Push send policy, device-state reporting and inbox rule; FCM stays primary

Status: Proposed · Date: 2026-11-20 · Deciders: product owner (with Claude) · Amends: [ADR-0017](0017-notifications-push-whatsapp.md)

## Context
ADR-0017 made FCM push plus the in-app inbox the primary patient channel on the owner's word that Firebase works in Syria and Azaz. Spike 0.3-S7 ([report](../spikes/s7-push.md)) measured it on an Android 13 emulator with Google Play services, over the owner's network through a VPN. Every graded state (foreground, background, swiped, screen off, Doze on its rerun, bucket `rare`, after reboot, offline with collapse and TTL, slow link) and a quick one-day run (53 sends a minute apart, Doze between them) showed 100% of due pushes within 60 s, and no message was lost because each had an inbox record first: the OD-52 pass mark is met. The Doze pass rests on that rerun: in the first attempt FCM accepted 20 pushes but the first 13 never reached the device, also not after its connection came back on the heartbeat reconnect about 7 minutes later (probably the host's VPN reconnecting; not proven); the owner counts the rerun (OD-54). Also seen: 120 non-collapsible pushes to an offline phone left only the last one shown (consistent with FCM's 100 pending limit; the threshold was not measured); Android hides a package's notifications past 50 posted ones. The newest Android release, a full day with long Doze, OEM battery managers and Syrian networks were not tested (OD-52, OD-54, OD-55).

## Decision
- **FCM stays primary** for patient events, after the inbox record (MSG-01 order unchanged). The decision holds on emulator evidence only: the real-phone run in Aleppo and Azaz (OD-52) must pass the same mark before the first pilot, or this ADR is revisited.
- **Inbox first, always.** Every patient message is written to the inbox before any push is sent; the app fetches the inbox on every open and polls it while open. A message counts as lost only if it is neither shown nor in the inbox.
- **Send policy:**
  - appointment and queue events are visible notifications (`android.notification`) at high priority on the "مواعيد" channel; data-only messages go at normal priority and are never used for something the patient must see;
  - one `collapse_key` per appointment (`appt_<id>`), so an offline phone gets only the newest message and stays below FCM's 100 pending messages;
  - TTL ends at the appointment time (for "turn near" and "called", at most a few minutes), so nothing arrives after it stops being true;
  - every send carries an `analyticsLabel` naming the event type (MSG-29);
  - `UNREGISTERED` marks the token dead at once; a new token from the next app open replaces it.
- **Device state, reported by the app on every open and on token refresh:** token (stored server-side only, logs show a hash), notification permission, the "مواعيد" channel importance, app version, SDK level, device brand, and the report time as "last seen".
- **Receipts:** the app acknowledges each push it receives (message id, receive time, app state) when it runs; FCM's `200` alone is not delivery.
- **Fallback rule (MSG-01, starting values, tuned in the pilot under OD-12):** a time-critical message (turn near, called) without a receipt after 2 minutes, or sent to a device whose report says permission denied or channel off, or whose last seen is older than 7 days, goes to the next channel at once. A reminder without a receipt gets the next channel 1 hour before the appointment. Huawei devices without Google services skip push (MSG-31).
- **Notification hygiene:** the app cancels its own stale notifications (a turn that was called, a past reminder) and keeps at most a few posted, because Android hides a package's notifications past 50.
- **Battery guide:** the per-brand Arabic guide (MSG-28, PAT-30) starts from the draft in the spike report and is verified on real phones before release; the app never requests a battery-optimisation exemption.

## Consequences
+ The primary channel is free, needs no linked numbers, and no patient message depends on push alone.
+ The backend sees denied permission and a disabled channel at the next app open, and stale devices by "last seen".
− A silent FCM disconnect is invisible to the backend; only the receipt timeout catches it, so time-critical events can still reach the patient late by the fallback window.
− The evidence is one emulator image through a VPN; real Syrian networks and OEM battery managers may change the numbers.
− Receipts and device reports add an endpoint and a `device` table in Phase A.

## Alternatives considered
- Replace FCM with WhatsApp as primary: rejected; FCM passed the mark and WhatsApp carries ban risk (ADR-0036).
- Trust FCM's `200` as delivery: rejected; the doze attempt and the pending limit both returned `200` for pushes that never showed.
- Non-collapsible reminders: rejected; 120 of them to an offline phone left one shown.

## Sources
[Spike report](../spikes/s7-push.md), OD-52, OD-54, OD-55, [RN-10 §6]
