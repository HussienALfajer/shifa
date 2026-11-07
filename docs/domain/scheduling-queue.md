# Scheduling and Queue

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-01, RN-02, RN-06, RN-11, RN-16

Purpose: defines how appointments and walk-in queue tickets are created, ordered, called and closed in one engine that the receptionist uses as the single source of truth. Booked visits and walk-ins are not two systems. This engine is Shifa's core daily loop and its main differentiator in Aleppo and Azaz: a unified queue, offline reception and a waiting-room display. Competitors either book time slots only or track a queue without a walk-in merge [RN-11 §1]. Built in **Phase A**.

Related: [voice calling](voice-calling.md) · [patient app](patient-app.md) · [messaging](messaging-and-verification.md) · [billing](billing-multicurrency.md) · [platform](platform-and-configuration.md) · [open decisions](../open-decisions.md)

## 1. Availability

- SCH-01 Each practitioner has working hours per branch (one schedule per practitioner × branch pair), with several shifts per day (for example a morning hospital shift and an evening clinic) [RN-06 §1].
- SCH-02 Exceptions override the working hours: holidays, leave, one-off extra shifts, and branch closures.
- SCH-03 Free slots are computed when requested, from rules minus busy intervals, not stored as precomputed slots [RN-06 §1].
- SCH-04 Each branch has an IANA time zone, and all times are stored as `timestamptz`.
- SCH-05 Appointment types have a name, a default duration, a colour, an optional linked service price and a buffer time (for example "new consultation 20 min", "follow-up 10 min", "cast removal 15 min").
- SCH-06 Resources (rooms, dental chairs, devices) can be required by an appointment type. A booking is valid only if the practitioner and every required resource are free.
- SCH-07 Recurring appointment series (Later).
- SCH-08 Automatic waitlist (Later).

## 2. Booking modes

- SCH-09 Each practitioner, or each shift, is set to one of two modes: **time slots** (specific times) or **queue numbers** (a shift with a capacity; the patient receives a number).
- SCH-10 Online booking rules can be set per practitioner: on or off, how far ahead booking is allowed, a maximum number of online bookings per shift, a cancellation deadline, and whether bookings are auto-confirmed or wait for staff approval.
- SCH-11 Online bookings that wait for approval appear in a booking-requests list. Staff accept or decline each request, and the patient is notified ([messaging](messaging-and-verification.md)).
- SCH-12 A slot is held for a short time (TTL, default 5 minutes) while a patient completes a booking. An expired hold frees the slot.
- SCH-13 Every create-booking command carries an idempotency key, so a retry on a flaky network never creates a duplicate booking.

## 3. Double-booking prevention

- SCH-14 Overlapping bookings for the same practitioner or resource are rejected by a PostgreSQL exclusion constraint (`tstzrange` + `btree_gist`), not by application checks alone. A conflict maps to HTTP 409 with a clear Arabic message [RN-06 §2].
- SCH-15 Deliberate overbooking is possible only through an explicit "overbook" action by permitted staff, and the booking is marked as overbooked.
- SCH-16 In queue mode, issuing a number is atomic per shift (a sequence per practitioner × shift), so two receptionists can never issue the same number.

## 4. Unified daily queue

- SCH-17 One daily list per practitioner (and per branch) merges walk-ins, phone bookings entered by staff, app bookings and web bookings.
- SCH-18 The visit statuses are: booked → confirmed → arrived → waiting → in room → done. The exits are: no-show and cancelled. Every transition is timestamped and records who made it.
- SCH-19 Check-in is manual by the receptionist. Optionally, the patient scans the clinic QR code.
- SCH-20 Walk-ins are inserted by a configurable rule. The default inserts one walk-in after every N booked patients; ordering by arrival is also possible.
- SCH-21 Emergency (pain/trauma) cases can be inserted at the top with a priority flag and a reason, which is audited.
- SCH-22 "Next patient" sets the current patient to done, calls the next one (see [voice calling](voice-calling.md)) and updates every connected screen in realtime (ADR-0015).
- SCH-23 Staff can also skip, recall, move a patient up or down, or mark a no-show. Each action is logged.
- SCH-24 Estimated waiting time is calculated per patient from average consult durations. It is shown to staff and to the patient app.
- SCH-25 A bulk delay notice ("the doctor is 30 minutes late") is sent to every patient waiting or booked in the shift.
- SCH-26 Staff can book a follow-up from the visit screen in one tap, with the type and interval pre-filled.
- SCH-27 A no-show counter is kept per patient per clinic and shown on the booking screen. Automatic blocking policies are Later.

## 5. Tickets and displays

- SCH-28 Queue tickets print on 58/80 mm thermal printers. A ticket shows the clinic name, doctor/room, number, date and time, and a QR code. The QR opens a no-login queue-status page.
- SCH-29 A waiting-room TV page shows the current numbers per room, the last calls and the next patients. Patient names are hidden by default.
- SCH-30 Staff can print the day list (A4) as a paper fallback for outages.

## 6. Offline reception (ADR-0014, Proposed)

- SCH-31 When the internet drops, the reception device keeps today's queue and appointments for its branch and can:
  - register a walk-in (with a provisional local number);
  - issue and print tickets;
  - change visit statuses;
  - take cash payments and print receipts;
  - call patients through the local display (see [voice calling](voice-calling.md)).
- SCH-32 Changes made offline are queued as idempotent commands and synced when the connection returns. Conflicts follow domain rules: the server's number sequence wins and provisional numbers are remapped visibly; payments are never dropped. Each conflict is shown to staff.
- SCH-33 The offline banner shows how long the device has been offline and how many changes are pending.
- SCH-34 The sync engine (PowerSync versus a custom outbox) will be chosen after the Phase 0 spike (OD-05).

## Key entities

- `schedule`: working hours per practitioner_role × branch.
- `schedule_exception`: leave, holidays, extra shifts.
- `appointment_type`: duration, buffer, colour, required resources, linked service.
- `shift`: a concrete working block on a date, with mode (slots or queue) and capacity.
- `appointment`: practitioner, patient chart, time range, status, source (walk-in/phone/app/web), priority, overbook flag.
- `booking_hold`: TTL reservation during online checkout.
- `queue_ticket`: per-shift number and QR token.
- `visit_status_event`: status history with actor and time.
- `booking_rule`: online booking policy per practitioner.
- `offline_command`: client-generated, idempotent change awaiting sync.

## Verification notes

- A concurrency test fires 50 parallel requests for one slot. Exactly one succeeds and 49 get 409.
- A queue-number test issues numbers from two receptionists at once and checks there are no duplicates or gaps.
- Availability tests cover exceptions, multi-shift days, buffers, multi-resource intersection and the branch time zone.
- An offline reconnect test (Playwright with network emulation) registers walk-ins and payments offline, reconnects, and checks there is no loss, no duplicates and that renumbering is visible.
- An idempotency test replays a create-booking request with the same key and gets the same result.
- A realtime test checks that "next patient" updates the reception, doctor and TV screens within 2 seconds on a LAN.
- Print snapshot tests render the 58 mm and 80 mm tickets in Arabic and compare them with golden images.
