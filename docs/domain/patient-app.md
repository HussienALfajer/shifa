# Patient App and Public Booking Pages

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-11, RN-06, RN-10, RN-17, RN-19, RN-03

Purpose: defines what patients use: the Flutter patient app (Android-first, ADR-0012) and the public booking web pages (Next.js on platform subdomains, ADR-0010). The app's job in Release 1 is to save patients the waiting: book or take a number, follow the queue live, and see what clinics release from the record. A family can be managed from one phone. Built in **Phase A**. Specialty items (dental charts, implant passport, ortho images) appear later as clinics release them.

Related: [messaging and verification](messaging-and-verification.md) · [scheduling and queue](scheduling-queue.md) · [voice calling](voice-calling.md) · [billing](billing-multicurrency.md) · [platform](platform-and-configuration.md) · [open decisions](../open-decisions.md)

## 1. Platform and quality targets

- PAT-01 The app is built with Flutter 3.47.x using the official MVVM layering (views → view models → repositories → services), with Riverpod 3, go_router and freezed. The API client is generated from the NestJS OpenAPI spec (swagger_parser) into its own package (ADR-0013) [RN-19 §B2–B4].
- PAT-02 Release 1 ships an Android build only. The iOS app comes Later. iPhone users use the public booking pages until then.
- PAT-03 The app is distributed through Google Play from the owner's existing developer account, with a signed direct APK as a fallback.
- PAT-04 Performance budget, tested on a 2–3 GB RAM Android device:
  - cold start under 2.5 s;
  - scrolling at 60 fps on lists;
  - APK under 30 MB per ABI split (target, to measure).
- PAT-05 The UI is Arabic-first RTL, built on Shifa's own design system generated from shared design tokens, the same source as the web (ADR-0011). There is no stock Material look.
- PAT-06 "Professional and creative": a few signature Rive animations (booking confirmed, your turn), purposeful motion, and accessible type sizes. Motion is reduced when the system "reduce motion" setting is on.
- PAT-07 Digits use one consistent style app-wide. The default (Latin or Arabic-Indic) is decided in OD-20.
- PAT-08 The app tolerates being offline: appointments, tickets and the medical file are cached in drift (SQLCipher-encrypted), and actions taken offline are queued as pending writes.

## 2. Account and family

- PAT-09 Patients log in with a phone number and reverse WhatsApp verification. Reception verification by QR is the fallback (see [messaging](messaging-and-verification.md)).
- PAT-10 One account holds several family profiles (children, parents), with a profile switcher on every booking screen.
- PAT-11 After the phone is verified, the app offers to link existing clinic charts that match the phone. The patient confirms each link, and nothing merges automatically.
- PAT-12 A consent and privacy screen explains what clinics share with the patient and what the patient shares with clinics. The patient's consent is stored with a version.
- PAT-13 Account deletion is a self-service request. Clinic-owned records stay with the clinic, as the law requires.

## 3. Find a doctor

- PAT-14 Patients search by specialty (General, Dental, Orthopedics in Release 1), city and area (Aleppo neighbourhoods, Azaz), and doctor or clinic name. Search normalises Arabic: alef/hamza variants, taa marbuta, yaa/alef maqsura and diacritics.
- PAT-15 Only verified doctors are listed, each with a verified badge.
- PAT-16 A doctor page shows:
  - photo and title;
  - specialty;
  - clinic address with a map (MapLibre + OSM);
  - working hours;
  - consultation fee in the clinic's currencies;
  - booking mode (time slot or queue number);
  - the next available slot or today's queue status.
- PAT-17 Public ratings and reviews (Later, OD-15).
- PAT-18 Patients can mark favourite doctors.

## 4. Book and queue

- PAT-19 Patients book a time slot or take a queue number, following the doctor's mode. They pick the family member, see the rules (cancellation deadline, arrival advice) and get an instant confirmation or a "request pending" state.
- PAT-20 Live queue view: current number, the patient's own number, how many patients are ahead, the estimated wait and the doctor's delay notices. It updates live over a websocket while the app is open, and by push otherwise.
- PAT-21 Patients get push notifications for "your turn is near" (configurable N patients ahead) and "تفضّل إلى العيادة ٢" when called (see [voice calling](voice-calling.md)).
- PAT-22 A reminder arrives before the appointment, with confirm and cancel actions. Cancelling or rescheduling is allowed within the clinic's rules, and the clinic queue updates instantly.
- PAT-23 "My appointments" lists upcoming and past visits per family member, with the clinic location and directions.
- PAT-24 Online payment (Later). Release 1 fees are paid at the clinic.

## 5. My medical file

- PAT-25 Patients see the items each clinic releases for each family member: visit summaries, prescriptions, reports and sick leaves, and attachments. The defaults for what is released are set in OD-14.
- PAT-26 Patients can record self-reported basics: allergies, chronic conditions, current medicines and blood group. These are shown to the clinic as "self-reported" when the patient books, if the patient consents.
- PAT-27 A prescription can be shown full screen (for the pharmacy) and shared as a PDF.
- PAT-28 Medication reminders, lab results and telemedicine (Later).

## 6. Notifications inbox

- PAT-29 Every message the patient receives is also in an in-app inbox, whichever channel delivered it.
- PAT-30 The app shows an Arabic battery-optimisation guide for each phone brand, offered on first launch and whenever push delivery appears blocked.

## 7. Public booking web pages

- PAT-31 Each clinic and doctor has a public page on a platform subdomain, built with Next.js 16, server-rendered for speed on 3G and indexed by search engines. It holds the same doctor information as the app [RN-17 §2].
- PAT-32 Booking works on the web without installing the app, using reverse WhatsApp verification. This is the main path for iPhone users in Release 1.
- PAT-33 Scanning the ticket QR opens a queue-status page with no login, showing the live position for that ticket only.
- PAT-34 Every clinic gets a printable QR poster that links to its booking page.
- PAT-35 Custom clinic domains (Later; see [platform](platform-and-configuration.md)).

## Key entities

- `person` and `dependent_link`: the global account and family profiles (see platform doc).
- `device`: FCM token and notification permission.
- `favourite`: patient → practitioner.
- `released_item`: a pointer to a clinic document released to the patient, with its release time.
- `self_reported_health`: patient-entered basics, with consent flags.
- `queue_status_token`: an unguessable token behind the ticket QR, valid for that day only.

## Verification notes

- Golden tests (alchemist) cover the RTL layouts of key screens at 3 text scales.
- Integration tests (Patrol/Maestro) cover login by reverse verification (with a mocked gateway), adding a family member, booking, receiving a "called" push and cancelling within the rules.
- A performance check on a low-end reference device records cold start and jank in CI artefacts.
- An offline test confirms that cached appointments and a ticket remain viewable in airplane mode, and that a cancellation made offline syncs on reconnect.
- A queue-status token test confirms the page shows only that ticket and expires at the end of the day.
- A search test runs a corpus of Arabic name and spelling variants and requires that each finds the same doctor.
- A web Lighthouse check on a throttled 3G profile requires an LCP of 2.5 s or less on the public doctor page.
