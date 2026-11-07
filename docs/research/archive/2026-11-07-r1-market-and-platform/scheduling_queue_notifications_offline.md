# Scheduling, Walk-in Queue, Notifications, Offline Resilience and Patient-App Capabilities for a Multi-Tenant Clinic SaaS in Syria (Aleppo/Azaz) — Research Notes (as of 7 Nov 2026)

> Scope note: web research only, conducted 7 Nov 2026. Several findings below (especially WhatsApp Business Platform eligibility for Syria and Google/Firebase availability) are **architecture-changing constraints** and are flagged as such. Vendor blogs are marked as vendor-authored where relevant.

---

## 1. Availability & slot engine design (working hours, exceptions, multi-resource, overbooking, slot generation vs on-the-fly, TZ/DST, RRULE)

### Takeaway
The proven pattern (Cal.com) is to store *rules* (recurring weekly hours per schedule/timezone + date overrides + out-of-office) and compute free slots **on request** by expanding rules into UTC intervals, subtracting a single sorted list of busy intervals, then sweeping once to emit start times — not to pre-materialize slot rows. FHIR's Schedule/Slot/Appointment model (with `busy-tentative` holds and an `overbooked` flag) is a good interoperable vocabulary for the same concepts.

### Cited Findings
- **Cal.com computes availability at request time and deliberately avoids precomputed availability tables**, because stale precomputed slots would offer times already taken; request-time caches are "short-lived by design." — [Cal.com engineering blog, "Scheduling is NP-hard, we need responses in milliseconds"](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Inputs to a single host's slot computation** in Cal.com: availability schedules in the host's own timezone (often several per host), date overrides that replace the recurring schedule on specific days, out-of-office/travel schedules (which can shift effective timezone mid-month), busy times from connected external calendars, booking/duration limits per day/week/month/year, minimum notice, buffers, slot intervals and offsets. — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Algorithm**: "Convert everything to intervals on one absolute time axis, sort once, sweep." Recurring rules are expanded once into UTC intervals (not evaluated per candidate slot); busy times, bookings and OOO go into one sorted exclusion list; each availability range is swept once with early `break`. Slot generation is a single forward walk emitting surviving start times. — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Booking limits are converted into synthetic busy intervals** (when a daily/weekly limit is reached the whole period becomes busy), so the slot loop never checks limits directly. — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Collective (multi-host) events**: each host's sorted intervals are folded into a running common-availability list with a two-pointer merge, stopping when the common list is empty. This is the same operation needed for **multi-resource booking (doctor ∩ room ∩ device)**. — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Timezone/DST handling**: conversion happens once per day per rule at the boundary; inner loops compare plain UTC milliseconds; DST changes and mid-month TZ swaps are handled in the rule-expansion step. — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Round-robin host selection** is greedy over `hostsAvailableAt(requestedTime)`: (1) largest shortfall vs weighted target share, (2) highest priority, (3) least recently booked — no backtracking. The blog frames enumerating one host's free slots as polynomial interval math; NP-hardness only arises in optimization (group common time, fairness). — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Performance figures (author's measurements)**: slot computation tens of ms; warm-cache response 30–75 ms; cold ~600 ms (incl. 200–300 ms Google free/busy call); 20-person team page ~3 s; round-robin over 40 hosts <1 ms. DB reads are batched into `Map<userId, rows>` lookups so math runs in memory. Errors from calendar providers are not cached (so a failure never shows as free time). — [Cal.com blog](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds)
- **Cal.com public API**: `GET https://api.cal.com/v2/slots` takes an event type ID/slug + username, start/end date and timezone. — search result summary of Cal.com v2 docs via [Cal.com blog search results](https://cal.com/blog/scheduling-is-np-hard-we-need-responses-in-milliseconds) (endpoint name not independently fetched; verify in Cal.com API v2 docs).
- **FHIR Slot (R5)**: `status` is required, one of `busy | free | busy-unavailable | busy-tentative | entered-in-error`; optional boolean `overbooked` means "this slot has already been overbooked, appointments are unlikely to be accepted"; if absent, systems may assume appointments are still available. A slot can have more than one appointment allocated, up to a system-defined number of places. — [HL7 FHIR Slot](https://hl7.org/fhir/Slot.html); [FHIR slot definitions](https://www.hl7.org/fhir/slot-definitions.html)
- **FHIR hold pattern (Austrian national R5 scheduling IG, not core spec)**: `$hold` sets Slot to `busy-tentative` and returns a `held-until` dateTime when the hold auto-expires; if another client already booked/held the slot the hold fails (`busy-unavailable`); the Appointment is created only at the final `$book` step referencing the slot. — [HL7 Austria Scheduling R5 IG – Slot profile](https://fhir.hl7.at/tc/wg/scheduling/r5/StructureDefinition-at-scheduling-slot.html); [IG home](https://build.fhir.org/ig/HL7Austria/TC-FHIR-AG-Scheduling-R5/) (IG version numbers vary 0.2.0–1.1.0 across builds)
- **FHIR AppointmentResponse**: participants respond with acceptance (or not) by creating AppointmentResponse resources; the Appointment's overall status updates after all responses are recorded. — [HL7 FHIR Appointment (R5 ballot)](https://hl7.org/fhir/2022Sep/appointment.html)

### Inferences
- **Recommended data model** (synthesizing Cal.com + FHIR): `schedule` (owner = practitioner|room|device, tenant_id, location_id, IANA tz e.g. `Asia/Damascus`), `availability_rule` (weekday, start/end local time, optional RRULE for non-weekly patterns, valid_from/to, location_id, allowed appointment_type_ids), `availability_override` (date-specific replace/close: holidays, Eid, doctor travel), `break` (as a rule of type "unavailable"), `appointment_type` (duration, pre/post buffer, required resource roles, capacity/seats, min-notice, max-advance, allow_overbook N), `booking` (tstzrange, status). Compute slots on the fly; cache per (practitioner, day) for seconds and invalidate on booking events.
- **Multiple locations per practitioner** fit naturally as rules tagged with `location_id`; the engine must also subtract travel buffers between locations on the same day (inference — not in sources).
- **Overbooking**: model as per-slot capacity (FHIR "multiple allocations up to a number of places") plus a separate `overbook_allowance` that only staff (not the patient app) can consume. Very common in Syrian practice where doctors see more patients than slots (inference).
- **Time zones**: Syria uses a single zone; store UTC + render `Asia/Damascus`. Syria dropped DST and moved to permanent UTC+3 in 2022 (from background knowledge — **not verified in this research session**; confirm against tzdata). Patients abroad (diaspora booking for parents) still require client-side TZ rendering.
- **Recurring appointments** (e.g., dialysis, physiotherapy, antenatal series): store a series with an RFC 5545 RRULE + EXDATE and materialize concrete occurrences as individual bookings (so each occurrence participates in the exclusion constraint). RFC 5545 defines RRULE/RDATE/EXDATE with TZID. — [RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545)

### Gaps
- Easy!Appointments internals (working-plan JSON, breaks, exceptions) were not researched in this session.
- Cal.com's `getSchedule` code path / exact file locations not verified; seated events not covered by the blog.
- tzdata status for Syria (permanent +03) not verified here.

---

## 2. Preventing double booking under concurrency (exclusion constraints, FOR UPDATE, advisory locks, holds with TTL, idempotency)

### Takeaway
Make the database the arbiter: a PostgreSQL `EXCLUDE USING gist (tenant_id WITH =, resource_id WITH =, tstzrange(start,end,'[)') WITH &&) WHERE (status is active)` constraint (requires `btree_gist`) is race-free; check-then-insert in application code or in a trigger under READ COMMITTED is not. Use advisory locks only where exclusion constraints can't express the rule (capacity > 1), and layer a TTL "hold" plus an idempotency key on top for the booking UX.

### Cited Findings
- PostgreSQL documents exclusion constraints on range types (the `reservation`/`during WITH &&` example, and with `btree_gist` combining a scalar `room WITH =` with `during WITH &&`). — [PostgreSQL docs: Range Types – Constraints on Ranges](https://www.postgresql.org/docs/current/rangetypes.html) (page timed out during this session; content corroborated by [boringsql "Beyond start/end columns"](https://boringsql.com/posts/beyond-start-end-columns/) and [OneUptime PostgreSQL range types](https://oneuptime.com/blog/post/2026-01-30-postgresql-range-types/markdown))
- `btree_gist` is what lets an equality column (resource/provider id) be combined with the range; without it only the range column can be in the constraint. Half-open `'[)'` bounds allow back-to-back bookings without phantom conflicts. — [DEV: Preventing double bookings with PostgreSQL exclusion constraints](https://dev.to/ripazocom/preventing-double-bookings-with-postgresql-exclusion-constraints-5efn); [boringsql](https://boringsql.com/posts/beyond-start-end-columns/)
- **Multi-tenant SaaS case study**: a trigger doing `IF EXISTS` overlap check under READ COMMITTED **raced 100% of the time** across five concurrent insert pairs (plain SELECT takes no locks; two uncommitted inserts both pass). Fix options: (a) exclusion constraint, which "replaces the trigger entirely"; violations raise SQLSTATE **`23P01 exclusion_violation`** (map to HTTP 409); (b) the author's chosen fix — `pg_advisory_xact_lock(hashtextextended(business_id || ':' || coalesce(employee_id,''), 0))` to serialize per (tenant, employee), because exclusion constraints **cannot express services allowing multiple concurrent bookings (group classes/capacity)**. Suggested DDL used `exclude using gist (business_id with =, coalesce(employee_id, sentinel_uuid) with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status not in ('cancelled','no_show'))`. — [DEV: How I solved double-booking race conditions in a multi-tenant SaaS](https://dev.to/prontodev/how-i-solved-double-booking-race-conditions-in-a-multi-tenant-saas-no-redis-no-distributed-locks-3gfa) (self-reported results)
- Partial exclusion constraint with a status predicate (e.g., `WHERE status = 'confirmed'`) so cancelled rows don't block new ones. — [Booking System Low-Level Design](https://www.techinterview.org/post/3233467856/lld-booking-system/) (less authoritative)
- Hold semantics in FHIR scheduling: `busy-tentative` + `held-until` expiry; concurrent hold attempts fail. — [HL7 Austria Scheduling R5 IG](https://fhir.hl7.at/tc/wg/scheduling/r5/StructureDefinition-at-scheduling-slot.html)

### Inferences
- **Recommended layered design**:
  1. `bookings` table with `tenant_id`, `resource_id`, `during tstzrange`, `status`; one exclusion constraint **per resource** (doctor, room, device). For multi-resource appointments insert one `booking_resource` row per resource in the same transaction — any conflict aborts the whole booking atomically.
  2. **Holds**: insert the row with `status='held'` and `hold_expires_at = now()+5–10 min` so the hold itself occupies the range under the same constraint; a sweeper (or `pg_cron`) flips expired holds to `expired` (excluded by the partial predicate). Confirming = UPDATE status to `confirmed`.
  3. **Capacity/overbook slots (N>1)**: use `SELECT ... FOR UPDATE` on a `slot_capacity` row or a transaction-scoped advisory lock keyed by (tenant, resource, slot_start), then count and insert.
  4. **Idempotency**: `idempotency_key` unique per (tenant, patient/device) stored with the booking result; retries from flaky mobile networks (very likely in Aleppo/Azaz) return the original result instead of creating a duplicate. (Idempotency/FOR UPDATE not covered by the cited sources — standard practice.)
- **Offline clinic edge-box writes** (see §6) must still go through this constraint when syncing; an offline-created booking that later conflicts needs a human-resolution queue, not silent last-write-wins.
- Note on `btree_gist` + `tenant_id` first column: also improves index selectivity in multi-tenant tables (inference).

### Gaps
- Official PostgreSQL docs page could not be fetched (socket timeouts); syntax should be checked against docs before implementation.
- No benchmark found for exclusion-constraint insert throughput at clinic scale (not expected to matter at this scale).

---

## 3. Walk-in queue / ticket systems (نظام الدور): mixing appointments and walk-ins, priorities, ETA, TV displays, live position, "turn near" alerts

### Takeaway
Commercial queue products (Waitwhile, Qminder) converge on: virtual ticket on the phone, live position tracking, ML/statistical wait-time estimates that update in real time, and SMS/email "it's your turn"/"position changed" notifications. Academic evidence favors hybrid queue-theory + ML models over naive averages for wait prediction, but no rigorous walk-in-clinic head-to-head was found; a simple, explainable estimator is the realistic MVP.

### Cited Findings
- **Waitwhile**: wait times "estimated using machine learning," tailored to each business; estimates update in real time and visitors are automatically notified; customers track place and wait on their phones; staff notify by text or email when it's their turn. — [Waitwhile waitlist features](https://waitwhile.com/features/waitlist/); [Waitwhile virtual waiting room](https://waitwhile.com/solutions/virtual-waiting-room); [Waitwhile SMS queue management](https://waitwhile.com/blog/sms-queue-management/)
- **Qminder**: customers are notified if their queue position changes; "AI-powered wait time estimates, and reminders"; automated messages for key moments like estimated wait time or follow-ups after service; SMS notifications start from the Business tier (per a comparison page). — [Qminder customer messaging](https://www.qminder.com/features/customer-messaging/); [Qminder vs Waitwhile](https://www.qminder.com/alternatives/waitwhile/)
- Neither vendor publishes its wait-time formula. — (gap confirmed across [Waitwhile](https://waitwhile.com/features/waitlist/) and [Qminder](https://www.qminder.com/features/customer-messaging/) pages)
- **Wait-time prediction evidence**: a 2025 JMIR Medical Informatics pediatric-hospital study used queueing theory to select predictors then trained ML models, concluding task-specific models are more appropriate; R² ranged from 0.114 to 0.719 depending on task (radiology poor). It cites an earlier study finding ML beat classical queueing models in complex settings. — [JMIR Med Inform 2025 e77297](https://medinform.jmir.org/2025/1/e77297)
- In emergency departments, ML models using queue/service-flow variables beat the best rolling average by >20% in MSPE. — [arXiv 2205.13067](https://arxiv.org/pdf/2205.13067v1.pdf)
- A radiology study explicitly modeled **walk-in and scheduled patients** together, comparing 10 ML algorithms. — [PMC7289434](https://rcastoragev2.blob.core.windows.net/6e013263708fde33a1c965e2b0f668d6/PMC7289434.pdf)

### Inferences
- **Unified queue model for Syrian clinics**: one `visit` entity per day per practitioner with `source ∈ {appointment, walk_in, follow_up/مراجعة, emergency}`, a `ticket_no` (printed, per-practitioner prefix e.g. A-012), `arrival_at`, `priority_class`, `state ∈ {waiting, called, in_consult, done, no_show, skipped}`. Ordering rule example: emergencies first; appointments called at slot time if arrived (grace window e.g. 10 min, after which they drop into walk-in order); walk-ins interleaved (e.g., 1 walk-in after every 2 appointments, configurable per doctor); "مراجعة" (short follow-up/result review) can get a fast lane. All rules should be tenant-configurable because practice varies by doctor.
- **ETA MVP**: `ETA = Σ(expected service time of patients ahead) / active servers`, where expected service time = rolling median per (doctor, visit type, hour-of-day), adjusted for doctor's actual start time today. Show ranges ("~25–40 min") rather than exact minutes; recompute on every state change. Upgrade to gradient-boosted model later once data accumulates.
- **TV display**: a browser page in kiosk mode on a cheap Android TV box/mini-PC subscribed to the queue channel (WebSocket/SSE) with Arabic TTS or pre-recorded audio of ticket numbers ("الرقم ١٢ إلى العيادة ٣"); must keep working on the clinic LAN when internet drops (see edge box, §6).
- **"Your turn is near" trigger**: notify when `position ≤ k` OR `ETA ≤ T` (e.g., 3 patients/15 min), once per threshold, with fallback channel chain (push → SMS; WhatsApp only where permitted — see §5).
- Many Syrian patients will wait outside or at nearby shops; live position in the app + a printed ticket with a QR code that opens a no-login web status page (no app install needed) is likely the highest-impact feature (inference).

### Gaps
- No published data on queue practices specific to Syrian/Middle-Eastern private clinics was found.
- No vendor discloses its ETA algorithm; no rigorous walk-in clinic study comparing queueing theory vs ML.

---

## 4. Waitlists, rescheduling, cancellation policies, no-show handling, and reminder-effectiveness evidence

### Takeaway
The best pooled evidence (Cochrane) shows SMS reminders raise attendance vs no reminder (RR 1.14) and perform about the same as phone calls; there is **no head-to-head RCT of WhatsApp vs SMS** — vendor claims of 35–70% reductions are unsupported. A Danish RCT found fines for no-shows did not reduce non-attendance. Prediction models reach AUC ~0.75–0.95, but evidence that model-driven overbooking improves outcomes is uncertain.

### Cited Findings
- **Cochrane review (2013)**: 7 studies, 5,841 participants: text-message reminders improved attendance vs no reminders, **RR 1.14 (95% CI 1.03–1.26)**; text vs phone-call reminders RR 0.99 (0.95–1.02). Attendance 67.8% (no reminder), 78.6% (SMS), 80.3% (phone call). Evidence low-to-moderate quality due to heterogeneity. — [Cochrane CD007458](https://www.cochrane.org/CD007458); [PubMed 24310741](https://pubmed.ncbi.nlm.nih.gov/24310741/)
- Guy et al. meta-analysis of SMS reminders: heterogeneity I² = 90%, so no summary effect computed. — [PMC3419880](https://pmc.ncbi.nlm.nih.gov/articles/PMC3419880/)
- Hasvold & Wootton systematic review: 29 studies/33 estimates on telephone and SMS reminders; e.g., one study DNA rate fell 19.5% → 9.8%, though many comparisons were non-randomised. — [PMC3188816](https://pmc.ncbi.nlm.nih.gov/articles/PMC3188816/)
- Existing systematic reviews indicate interventions against non-attendance all have "a modest effect." — [BMC Health Serv Res 2023, s12913-023-10059-9](https://bmchealthservres.biomedcentral.com/counter/pdf/10.1186/s12913-023-10059-9.pdf)
- **WhatsApp vs SMS**: no head-to-head trial found; vendor blogs claim 50–70% (WhatsApp) vs 20–30% (SMS) reductions or a 22%/16%/14.3% three-arm comparison without methods/sample size — treat as unverified marketing. — e.g., [ChatDaddy blog](https://chatdaddy.tech/blog/whatsapp-appointment-reminder); [Zavis UAE guide](https://www.zavis.ai/guides/reduce-patient-no-shows-uae) (both vendor content)
- **Fines don't work (Danish RCT)**: 6,746 orthopaedic-clinic appointments randomized to a DKK 250 (€34) no-show fine policy (n=3,333) vs usual practice (n=3,413), May–Nov 2015; at a ~5% baseline, fining "does not seem to further reduce non-attendance"; cost difference DKK 10 per appointment (95% CI −9 to 22), not significant. — [Blæhr et al., BMJ Open 2018 (PMC5988103)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5988103); [Trial protocol, Trials 2016](https://link.springer.com/doi/10.1186/s13063-016-1420-3)
- **No-show prediction**: 2025 review of 52 publications (2010–2025) reports best ML AUCs ~0.75–0.95 (accuracy 52%–99.44%, a range suggesting heterogeneous/imbalanced evaluation). — [Khalifa University repository abstract](https://khazna.ku.ac.ae/en/publications/predicting-patient-no-shows-using-machine-learning-a-comprehensiv/) (abstract only)
- Earlier PRISMA review: 50 articles on no-show prediction. — [Carreras-García et al., Entropy 2020 (PMC7517206)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7517206/)
- Rapid systematic review: the effect of predictive-model-based **overbooking** was uncertain; little information on cost-effectiveness, acceptability, equity. — [PMC9933067](https://pmc.ncbi.nlm.nih.gov/articles/PMC9933067)

### Inferences
- **Reminder design**: two-touch (e.g., 24–48 h and 2–3 h before) with **actionable confirm/cancel/reschedule** buttons — cancelled slots should immediately feed the waitlist. Channel choice matters less than reach and the ability to reply.
- **Waitlist engine**: per (doctor, date range, time-of-day preference) entries; on cancellation, offer the slot to the top N waitlisted patients simultaneously with a short claim TTL (first-to-confirm wins via the same exclusion constraint), then cascade.
- **No-show policy**: prefer soft measures (track per-patient no-show count; require confirmation or deposit only after ≥2 no-shows; deprioritize online booking privileges) over fines, given the RCT. Deposits are additionally constrained by Syria's limited online-payment rails (inference; payments not researched here).
- **Overbooking**: start with rule-based per-doctor overbook allowance; collect data for a no-show model later, but do not auto-overbook from model output until validated locally.

### Gaps
- No Middle-East/Syria-specific no-show rate data found.
- No RCT of WhatsApp vs SMS vs push reminders; no evidence on push-notification reminders specifically.

---

## 5. Notifications: WhatsApp Business Platform (Cloud API) pricing & eligibility, OTP, SMS gateways, FCM, email, fallback chains

### Takeaway
**Critical constraint:** Meta's official WhatsApp Business Platform documentation lists **Syria** among sanctioned places where businesses are not eligible to use the Platform **and where WhatsApp users are not eligible to receive Platform messages**; +963 numbers cannot be registered; Meta for Developers is reported blocked from Syria as of 4 Nov 2026, despite US sanctions relief in 2025 and Syria–Meta talks in Oct 2026. Official WhatsApp (Cloud API) reminders/OTP to +963 patients are therefore **not currently possible**; the notification layer must be channel-agnostic, with push + SMS as primary and WhatsApp as a "switch-on later" adapter (and possibly usable today for patients with Turkish +90 numbers, common around Azaz — to be verified).

### Cited Findings
**Eligibility (Syria)**
- Meta's WhatsApp Business Platform support page: businesses in "Cuba, Iran, North Korea, Syria, and three sanctioned regions in Ukraine" are not eligible; WhatsApp and WhatsApp Business app users there "are not eligible to receive messages sent via the WhatsApp Business Platform." Türkiye was un-restricted as of 15 May 2024. No date given for the Syria entry. — [Meta for Developers – WhatsApp Business Platform support](https://developers.facebook.com/documentation/business-messaging/whatsapp/support)
- 360dialog (a major BSP) lists Syria (+963) among blocked regions whose numbers cannot be registered; "restrictions are based on the phone number's country code." — [360dialog client FAQ](https://docs.360dialog.com/docs/support/client-faq)
- Syniverse lists Syria among countries where the WhatsApp Business Solution may not be used to send messages to or from. — [Syniverse messaging rules](https://sdcsupport.syniverse.com/hc/en-us/articles/360012065193-Syniverse-WhatsApp-Business-Channel-Messaging-Rules) (via search snippet)
- Monitoring site Unblock Syria: **Meta for Developers "Blocked"** in Syria (last updated 2026-11-04), described as company policy lagging the law; WhatsApp Business (app) "usable" with paid features failing (as of 23 Sep 2026); a Meta review request filed in March had no response. — [Unblock Syria – Meta for Developers](https://unblocksyria.com/en/services/meta-for-developers); [Unblock Syria – WhatsApp Business](https://unblocksyria.com/en/services/whatsapp-business) (advocacy/monitoring source)
- On 11 Oct 2026 Syria's ICT Minister Abdulsalam Haykal met Meta's MEA MD Fares Akkad to discuss restoring advertising tools and business services on Facebook, Instagram and WhatsApp; no timeline given. — [SANA, 11 Oct 2026](https://sana.sy/en/economic/2349688/)
- Sanctions context: US Treasury General License 25 (23 May 2025) effectively allowed tech companies to serve Syrians; EFF warns companies historically over-comply and are slow to respond. — [EFF, "A New Digital Dawn for Syrian Tech Users"](https://www.eff.org/deeplinks/2025/06/new-digital-dawn-syrian-tech-users). Unblock Syria states Syria was removed from the US State Sponsors of Terrorism list on 2026-08-24. — [Unblock Syria – Firebase](https://unblocksyria.com/en/services/firebase) (not independently verified)

**WhatsApp pricing (for when/where it becomes usable)**
- Per-message pricing since **1 July 2025** (replacing conversation-based); charged on delivery; rates by category and recipient country code ("market"). Template categories: marketing, utility, authentication (plus higher "authentication-international" rates in some markets); non-template "service" messages only inside the 24 h customer service window. — [Meta: Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- **Free today**: utility templates sent inside an open customer service window (since 1 Jul 2025, through 30 Sep 2026); 1,000 free service messages per business phone number per month (through 30 Sep 2026); free-entry-point window up to 7 days after a Click-to-WhatsApp ad reply. — [Meta pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- **Changed 1 Oct 2026**: service messages beyond the 1,000/month tier became billable; utility messages inside the service window became billable; businesses without a payment method by 30 Sep 2026 may have service delivery stopped; government/non-profit exemption for service messages through 31 Dec 2027. Meta Business Agent (Meta-hosted AI) billed $2.00 per million tokens (~4–5¢/message est.). Meta changes prices only on the first day of a quarter (1-month notice for rate changes, 6 months for model changes). — [Meta pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) (note: page content as fetched 7 Nov 2026 described these as upcoming/now-effective; third-party summaries agree on the 30 Sep 2026 cut-off — [Sent.dm guide](https://docs.sent.dm/docs/guides/whatsapp-pricing))
- Volume tiers apply to utility and authentication per market/category, aggregated across a business portfolio, reset monthly. Syria is not listed on the rate card; unlisted countries fall under "Other". Türkiye/Turkey rates should be checked on the rate card CSV. — [Meta pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- **Authentication templates for OTP**: three button types — Copy code (all devices), One-tap autofill (Android only, needs app package name + 11-char signature hash), Zero-tap (Android, code broadcast to app via SMS Retriever API, requires accepting zero-tap terms); one-tap/zero-tap fall back to copy code if the handshake fails. — [Meta authentication templates](https://developers.secure.facebook.com/docs/whatsapp/business-management-api/authentication-templates); [Kapso docs](https://docs.kapso.ai/docs/whatsapp/templates/authentication.md); [Chakra guide](https://chakrahq.com/article/whatsapp-authentication-templates-otp-guide)
- WhatsApp changed its Business terms (Oct 2025) to bar general-purpose AI chatbots from the platform (task-specific bots such as booking remain the intended use). — [TechCrunch, 18 Oct 2025](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform)

**SMS in Syria**
- Syriatel described as the active operator (~80% share); MTN Syria's status is contested (one source says exited Aug 2021; another reports Zain taking over the former MTN network). Only OTT brands and banks reportedly permitted to send A2P SMS into Syria (single vendor source); regulator is SYTPRA. — [Sent.dm Syria SMS guide](https://www.sent.dm/en/resources/sms-compliance/syria-sms-guide); [Developing Telecoms tag page](https://www.developingtelecoms.com/component/tags/tag/tyntec.html)
- Syrian operators apply strong A2P filtering; unregistered sender IDs and spam-like content commonly blocked. — [D7 Networks blog](https://d7networks.com/blog/why-sms-deliverability-in-syria-is-tricky-and-how-to-improve-it/)
- International aggregators advertising Syria coverage: SMS.to, Messaggio, Infobip, D7; prices inconsistent (≈10–25 SYP local vs $0.10–0.30 international per message). — [SMS.to Syria](https://sms.to/bulk/syria); [Messaggio Syria](https://messaggio.com/messaging/syria); [Sent.dm Syria pricing](https://www.sent.dm/resources/syria-sms-pricing)

**Azaz / northern Aleppo telecoms**
- Residents of Azaz and border areas have long used Turkish SIMs (Turkcell, Türk Telekom) and the local E-lux network (which rides on Turkcell towers); many own several SIMs; obtaining a Turkish line generally requires a Turkish temporary-protection ID (kimlik). — [Enab Baladi, Oct 2024](https://english.enabbaladi.net/archives/2024/10/residents-of-aleppo-countryside-torn-between-4g-e-lux-and-turkish-networks/?so=related); [Arab News/AFP 2018](https://www.arabnews.com/node/1395551/amp)
- Turkcell launched nationwide international roaming in Syria in Dec 2025. — [MEA Tech Watch, 24 Dec 2025](https://meatechwatch.com/2025/12/24/turkcell-launches-nationwide-international-roaming-services-in-syria/)

**Push (FCM) / Google services**
- Google Play Store became reachable without VPN for many users in Syria from 18 Jan 2026; minister said most Google platforms would follow in a phased rollout requiring per-service legal/technical approvals. — [Anadolu Agency, 18 Jan 2026](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- Firebase: "Partly available" in Syria (last updated 2026-11-04); Firebase support said in Oct 2026 that Firebase "cannot be used from certain countries"; FCM status not stated. — [Unblock Syria – Firebase](https://unblocksyria.com/en/services/firebase)

### Inferences
- **Notification architecture**: an internal `notification_intent` (patient, event type, payload, urgency, deadline) → a **channel router** with per-tenant/per-patient policy → adapters (FCM push, SMS aggregator(s), WhatsApp Cloud API [feature-flagged by recipient country code], Telegram bot [optional], email, in-app inbox) → delivery-receipt webhooks → **fallback chain on timeout** (e.g., push not acknowledged/opened in X min → SMS). Store every attempt with status (queued/sent/delivered/read/failed) for audit and cost reporting.
- **Recipient-aware WhatsApp gating**: allow WhatsApp only for non-+963 numbers (e.g., +90 for Azaz patients, diaspora relatives) until Meta's policy changes; this needs legal review because Meta's text restricts *users in* Syria, not only +963 numbers. The app's backend/BSP account must be held by a non-Syrian legal entity (e.g., Turkey/UAE) — inference requiring legal confirmation.
- **Unofficial WhatsApp gateways** (WhatsApp Web automation libraries) are widely used in the region but violate WhatsApp terms and risk number bans; not recommended for a SaaS foundation (inference; not researched).
- **Phone-OTP login without WhatsApp**: SMS OTP via an aggregator with Syria coverage (test Syriatel and the other operator separately, plus Turkish numbers), with **Android SMS Retriever** autofill; consider allowing clinic staff to verify a patient in person (QR pairing) as a fallback when SMS fails. Push-only flows depend on FCM working on the device — FCM delivery uses Google Play services on the handset, which was historically restricted in Syria; must be field-tested (inference).
- **Cost control**: since WhatsApp in-window utility is no longer free after 1 Oct 2026, and SMS into Syria is relatively expensive, push-first with SMS escalation only for time-critical messages (turn-is-near, OTP, same-day changes) is the economical default.

### Gaps
- No official statement from Meta on whether Syria will be removed from the WhatsApp Business Platform restriction list; status could change quickly — re-check before launch.
- Unclear whether Meta enforces the Syria restriction by recipient country code only, or also by IP/location (affects Turkish-SIM users physically in Azaz).
- No verified current A2P SMS regulations/prices from SYTPRA or operators.
- FCM reliability inside Syria in late 2026 not confirmed by any primary source.
- Email deliverability, Telegram usage share in Syria not researched.

---

## 6. Offline-first / resilience for clinics with power and internet cuts

### Takeaway
Power remains unreliable outside Damascus (Aleppo had ~6 h/day in Aug 2025; national supply improved through 2026 but with rationing and faults), so reception desks must keep booking, queueing and printing during outages. Among sync engines, **PowerSync** is the only mainstream Postgres-backed option with full offline reads **and writes** plus official React Native/Flutter/web SDKs; **Zero** (1.0, 2026) explicitly does not support offline writes; **ElectricSQL** is read-path only (you build writes). A **local edge box** at larger clinics gives LAN-level continuity for queue displays and printing.

### Cited Findings
**Infrastructure context**
- Syrian Energy Ministry data (via Almodon): supply rose from ~8 h/day to 20+ h in some areas in H1 2026; Damascus got 24 h power by Aug 2026 while other governorates waited. — [Almodon, 3 Sep 2026](https://www.almodon.com/economy/2026/09/03/%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1-%D8%A7%D9%84%D8%B3%D9%88%D8%B1%D9%8A%D8%A9-%D8%AA%D8%AA%D8%B9%D8%A7%D9%81%D9%89-%D8%AA%D8%AF%D8%B1%D9%8A%D8%AC%D9%8A%D8%A7-%D9%87%D9%84-%D8%AA%D8%AF%D9%88%D9%85-%D8%A7%D9%8424-%D8%B3%D8%A7%D8%B9%D8%A9); [Almodon, 17 Aug 2026](https://www.almodon.com/economy/2026/08/17/%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1-24-%D8%B3%D8%A7%D8%B9%D8%A9-%D9%81%D9%8A-%D8%AF%D9%85%D8%B4%D9%82-%D8%A8%D8%A7%D9%86%D8%AA%D8%B8%D8%A7%D8%B1-%D8%A7%D9%84%D9%85%D8%AD%D8%A7%D9%81%D8%B8%D8%A7%D8%AA-%D8%A7%D9%84%D8%A3%D8%AE%D8%B1%D9%89)
- Aleppo: Feb 2026 improved supply "with frequent malfunctions"; a new rationing program started in Aleppo (July 2026); later reporting of escalating rationing without schedules in Syria. — [Enab Baladi 795620](https://www.enabbaladi.net/795620/); [Enab Baladi 816183](https://www.enabbaladi.net/816183/برنامج-تقنين-جديد-للكهرباء-يبدأ-في-حلب/); [Enab Baladi 817648](https://www.enabbaladi.net/817648/الكهرباء-في-سوريا-تصاعد-التقنين-بلا-جد/)
- Aug 2025: Aleppo ~6 h/day (2 on / 4 off) — reported via search summary of Enab Baladi coverage. — [Enab Baladi Aug 2025 (energy ministry)](https://english.enabbaladi.net/archives/2025/08/syrias-energy-ministry-says-electricity-supply-to-rise-as-azerbaijani-gas-deliveries-stabilize/amp/)
- Northern Syria: in July 2024 most internet networks around Azaz were down except Turkcell, Türk Telekom and E-lux, which ran intermittently. — [Enab Baladi, Jul 2024](https://english.enabbaladi.net/archives/2024/07/for-the-fourth-day-internet-networks-are-down-or-weak-in-northern-syria/amp/)

**Sync engines**
- **PowerSync**: client writes go to a local SQLite DB and an upload queue; SDK calls your `uploadData()`; you call `complete()` after success; if not completed after an error, the SDK retries indefinitely (blocking the queue). Default conflict behavior is essentially last-write-wins, customizable on your backend (field-level LWW, business-rule validation, dead-letter queue for unprocessable changes). PowerSync guarantees client state is consistent with server once the queue is empty. Clock skew can cause false conflicts. — [PowerSync: Handling writes](https://docs.powersync.com/handling-writes/); [Custom conflict resolution](https://docs.powersync.com/handling-writes/custom-conflict-resolution); [Handling write validation errors](https://docs.powersync.com/handling-writes/handling-write-validation-errors)
- PowerSync has official React Native support; ElectricSQL community-supported; Replicache unsupported (third-party comparison). — [ElectricSQL vs PowerSync vs Replicache](https://telemetry-landing.pages.dev/blog/electricsql-vs-powersync-vs-replicache/)
- **Zero (Rocicorp)**: v1.0 declared stable in 2026 (a relabel of 0.26.2). — [Zero 1.0 release notes](https://zero.rocicorp.dev/docs/release-notes/1.0); [InfoQ, Jun 2026](https://infoq.com/news/2026/06/zero-version-1). Zero **"does not support offline writes"**: reads from synced data continue offline but writes are rejected once `disconnected` (after 1 min of failed reconnects by default); "Zero is not designed for long periods offline." Data persisted in IndexedDB (browser) or SQLite (React Native). — [Zero docs: Offline](https://zero.rocicorp.dev/docs/offline)
- **Replicache** is in maintenance mode (no new features); Zero's client uses Replicache internals. — [rocicorp/mono forum](https://forums.basehub.com/rocicorp/mono/1); [Replicache guide](https://telemetry-landing.pages.dev/blog/replicache-local-first-sync/) (third-party quotes of replicache.dev)
- **ElectricSQL** (now at electric.ax): "Electric does not do write-path sync." Four write patterns: online writes via API; optimistic component state; shared persistent optimistic state (e.g., localStorage) with per-write rollback; through-the-database sync (local PGlite + triggers + custom sync utility) for full offline. — [Electric docs: Writes](https://electric.ax/docs/guides/writes)
- A 2026 survey of 26 local-first databases names Zero, PowerSync, ElectricSQL, InstantDB and Turso as top-tier. — [LetsDataScience analysis](https://www.letsdatascience.com/news/developers-adopt-local-first-databases-for-performance-94cb2640) (aggregator)

**Printing**
- Direct browser printing to ESC/POS thermal printers is possible via **WebUSB / Web Serial** (Chromium-only), sending raw bytes in chunks; or via a local bridge such as **QZ Tray** (or open-source NanoPrint, which speaks the qz-tray.js protocol) for USB/serial printers. Recommended: generate ESC/POS bytes rather than HTML via browser print dialog; keep formatting separate from connection layer. — [thermoprint example](https://docs.rs/crate/thermoprint/latest/source/js/printer.js); [QZ Tray](https://qz.io/); [NanoPrint on AlternativeTo](https://alternativeto.net/software/nanoprint/about/); [forum answer](https://yomotherboard.com/question/whats-the-best-way-to-print-esc-pos-receipts-from-a-web-saas-2/)

### Inferences
- **Tiered resilience model**:
  1. *Patient app*: cache own bookings, tickets, prescriptions, family profiles locally (SQLite); queue booking requests offline only as "requests" (not confirmed bookings) to avoid conflicts.
  2. *Reception (web/PWA or desktop)*: local-first DB (PowerSync SQLite/IndexedDB or custom) holding today's + next N days' schedule and queue for that clinic; offline actions = check-in walk-in, issue ticket, call next, mark done/no-show, record payment, print. These are **append-mostly events** (low conflict). New future bookings created offline should be marked `pending_sync` and reconciled against the server's exclusion constraint on reconnect; conflicts go to a staff resolution inbox.
  3. *Edge box (optional, larger clinics/polyclinics)*: small Linux mini-PC or Raspberry Pi-class device on UPS/battery running a local sync node + queue WebSocket hub + print server; TV displays and reception PCs talk to it over LAN so queue calling and printing survive internet outages; the box syncs upstream when connectivity returns. Since most clinics already run on "ampere" generator subscriptions and UPS for lights/router (inference from context of generator subscriptions — [Enab Baladi on ampere subscriptions](https://english.enabbaladi.net/archives/2024/10/ampere-subscriptions-empty-pockets-of-aleppo-residents/amp/)), a 10–20 W box plus router on a UPS is realistic.
- **Conflict model for queue**: model the queue as an event log per (clinic, doctor, day) with Lamport/hybrid logical clocks and deterministic ordering; ticket numbers should be allocated from **per-device ranges or prefixes** (e.g., reception-1 issues A-001…, edge box issues B-…) to avoid duplicate numbers when partitioned.
- **Tech choice**: PowerSync fits best if mobile + web both need offline writes against Postgres; ElectricSQL is viable only if the team builds its own write path; Zero is unsuitable for reception offline mode. RxDB/WatermelonDB are alternatives when building a custom sync protocol (not researched in depth this session).
- **Arabic on thermal printers**: ESC/POS code pages poorly support Arabic shaping/RTL; safest approach is to render the ticket/receipt as a bitmap (canvas → raster ESC/POS `GS v 0`) in the client — inference; not verified in sources. A5 prescriptions should use HTML/CSS print with `@page { size: A5 }` and embedded Arabic fonts (inference).

### Gaps
- No current Aleppo/Azaz-specific internet outage statistics for 2026 found.
- RxDB, WatermelonDB, PGlite maturity/pricing not researched in depth; PowerSync pricing/self-hosting (Open Edition) not verified this session.
- No source tested Arabic text rendering on common ESC/POS printers.

---

## 7. Patient app capabilities (OTP login, family profiles, Arabic search, maps, booking, PHR, reminders, telemedicine, chat, payments, reviews, accessibility)

### Takeaway
Most capabilities are standard, but three need special engineering in Syria: (1) OTP delivery (no official WhatsApp to +963; SMS filtering), (2) **Arabic search normalization** (Meilisearch's tokenizer Charabia has a dedicated Arabic pipeline; Typesense relies on ICU locale `ar` with less documented Arabic normalization; Postgres FTS has no Arabic stemmer out of the box — verify), and (3) telemedicine on poor bandwidth (audio-first; LiveKit offers simulcast/dynacast/RED; Twilio Video was *not* retired).

### Cited Findings
- **Meilisearch / Charabia Arabic pipeline**: Arabic `ال` segmentation + Unicode compatibility decomposition + nonspacing-marks (harakat) removal + **Tatweel, Alef, Yeh and Taa Marbuta normalization** + Persian digits → ASCII (0.9.x+). Whether hamza forms (أ/إ/آ) fold to bare alef isn't stated explicitly in the README. — [charabia on docs.rs (latest)](https://docs.rs/crate/charabia/latest); [charabia 0.10.0](https://docs.rs/crate/charabia/0.10.0)
- **Typesense**: per-field `locale` in schema (ISO 639-1, `ar` listed as RTL); uses ICU; default (no locale) strips European accents; Arabic diacritic handling not documented. — [Typesense locale guide](https://typesense.org/docs/guide/locale.html)
- Lucene's ArabicNormalizer (reference behavior): removes harakat, normalizes alef variants and teh marbuta. — [Lucene.NET ArabicNormalizer](https://lucenenet.apache.org/docs/4.8.0-beta00018/api/analysis-common/Lucene.Net.Analysis.Ar.ArabicNormalizer.html)
- Discourse users documented missing Arabic normalization (hamza variants, Ya/Kaf forms, orthographic equivalence) in a Postgres-FTS-based product — illustrating the gap with default Postgres search. — [Discourse Meta thread](https://meta.discourse.org/t/arabic-search-normalization-missing-support-for-hamza-variants-ya-kaf-forms-and-orthographic-equivalence/384253/2?tl=en)
- **Twilio Video**: EOL had been announced for 5 Dec 2026 (Mar 2024), then **reversed on 21 Oct 2024** — Video remains a standalone product; 2026 changelog shows continued work (Samsung Internet support Apr 2026; Node.js Media SDK public beta 30 Sep 2026). — [Twilio changelog: Twilio Video will remain a standalone product](https://static1.twilio.com/en-us/changelog/-twilio-video-will-remain-a-standalone-product); [BlogGeek.me](https://bloggeek.me/twilio-programmable-video-back/); [Twilio Video changelog](https://www.twilio.com/en-us/changelog?products=video)
- **LiveKit** bandwidth features: simulcast by default; adaptive stream (subscriber side picks layer by element size/visibility); dynacast pauses unused layers; audio as separate RTP stream with **RED enabled by default** for packet-loss resilience; with SVC codecs (VP9/AV1) dynacast pauses whole streams only. — [LiveKit docs: Codecs & more](https://docs.livekit.io/transport/media/advanced.md); [LiveKit 1.0 blog](https://livekit.com/blog/livekit-one-dot-zero); [LiveKit audio quality blog](https://livekit.com/blog/audio-quality)
- Turkish SIM / multi-SIM behavior in Azaz (affects phone-number identity and OTP): see §5 — [Enab Baladi, Oct 2024](https://english.enabbaladi.net/archives/2024/10/residents-of-aleppo-countryside-torn-between-4g-e-lux-and-turkish-networks/?so=related)

### Inferences
- **Identity model**: `account` (login phone, possibly multiple phones: +963 and +90) ↔ many `patient` profiles (self, children, elderly parents) with relationship + consent flag; a patient can be linked to multiple accounts (e.g., two siblings managing a parent). Clinics create patient records at the desk without an account; app users later "claim" records via OTP to the phone on file or a QR printed on the visit receipt. Dedupe on (normalized Arabic name + DOB + phone) with human merge.
- **Arabic normalization** (apply at index and query time regardless of engine): strip harakat & tatweel; أ/إ/آ/ٱ → ا; ى → ي; ة → ه (for search only); ؤ → و, ئ → ي; Eastern-Arabic digits ٠-٩ → 0-9; transliteration synonyms for common Latin-typed queries ("dr ahmad", "a5isa2i") and specialty synonyms (أسنان/سنية/dentist, نسائية/توليد/gyne). Meilisearch is likely the lowest-effort choice for Arabic + typo tolerance; Postgres FTS would need custom normalization functions + `pg_trgm` (inference).
- **Maps**: Google Maps SDK availability in Syria uncertain (Google services phased restoration); OpenStreetMap-based tiles (MapLibre) plus "landmark" text addresses (Syrian addresses are often descriptive) are a safer default (inference).
- **PHR**: prescriptions, lab results (PDF/image), vaccination schedule (child immunization reminders are high-value), visit summaries; all cached offline on device. Medication reminders should use **local scheduled notifications** (not server push) so they fire without internet; low-end Android OEM battery optimizations can kill alarms — require exact-alarm permission handling and onboarding to whitelist the app (inference; not researched this session).
- **Telemedicine**: default to **audio-first** consultations with optional video, asynchronous chat + photo upload (store-and-forward) as the fallback for very poor links. Self-hosted LiveKit or Jitsi on a nearby region (e.g., Türkiye/Gulf) reduces latency; Twilio Video is still available but US-based sanctions-compliance posture for Syrian users should be checked (inference).
- **Payments**: card/online payment rails in Syria are limited; plan for "pay at clinic" plus local wallets/transfer services later (inference; not researched — likely covered by another researcher).
- **Reviews**: only allow reviews tied to a completed visit; moderate via queue + keyword filter in Arabic; doctors in conservative markets may resist public ratings — make it tenant-optional (inference).
- **Elderly accessibility**: large text scaling support, high contrast, voice notes instead of typing, icon+text buttons, family-member proxy booking, and a "call the clinic" fallback (inference).

### Gaps
- Postgres FTS Arabic support (snowball has an Arabic stemmer in newer versions — not verified this session).
- Jitsi, Agora, Daily 2026 status and pricing not researched; no bandwidth measurements from Syria.
- In-app chat architecture and moderation, payment options in Syria not researched.

---

## 8. Mobile tech choice for low-end Android (Flutter vs React Native/Expo, APK size, RTL, OTA) and PWA viability

### Takeaway
The most rigorous 2026 comparison (Software Mansion, which builds React Native tooling) found Flutter downloads were less than half React Native's size and cold-started ~2× faster on a budget Android (Motorola G15), with React Native better on iPhone RAM. OTA: Expo EAS Update for RN (CodePush retired 31 Mar 2025), Shorebird for Flutter; neither patches native code.

### Cited Findings
- Software Mansion built the same app in both: on Android, Flutter's download < half RN's and ~2× faster cold start on budget phones (Motorola G15 among devices); installed size expands ~2.5× (Flutter) vs ~3.5× (RN); on iPhone RN used less RAM. — [Software Mansion blog](https://swmansion.com/blog/we-built-the-same-app-in-flutter-and-react-native-here-s-what-we-found/) (page returned 404 on direct fetch during this session; figures taken from search-result excerpt)
- Other benchmarks conflict (e.g., RN APK 8.7 MB vs Flutter 12.4 MB in one; Flutter 16.8 MB vs RN 21.9 MB in another) with weaker methodology. — [DEV Community benchmark](https://dev.to/encodedots/react-native-vs-flutter-which-delivers-better-performance-for-modern-apps-3d5n); [tech-insider 2026](https://tech-insider.org/flutter-vs-react-native-2026/)
- **OTA**: Shorebird pushes Dart-code patches on Android/iOS via a modified engine/interpreter; EAS Update offers staged rollouts, rollback, code signing, priced per MAU + bandwidth; Microsoft CodePush retired 31 Mar 2025; neither can update native code. — [Bitrise CodePush alternatives](https://bitrise.io/blog/post/codepush-alternatives); [Shorebird blog](https://shorebird.dev/blog/flutter-vs-react-native) (vendor)
- Google Play Store reachable from Syria without VPN since Jan 2026 (phased). — [Anadolu Agency](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)

### Inferences
- For a patient app targeting low-end Android with patchy data, **Flutter** has the edge on download size/cold start; **React Native/Expo** has the edge if the team is TypeScript-heavy and wants code sharing with a React web reception app and PowerSync/Expo ecosystem. Both support RTL (Flutter via `Directionality`/localization; RN via `I18nManager`) — RTL quality not benchmarked in sources.
- **Distribution**: provide APK direct download (from the clinic's website/QR) in addition to Play Store, since Play access was only restored in 2026 and many devices may have outdated Play services; OTA updates matter more where users rarely update apps.
- **PWA viability**: strong for clinic staff (reception, TV display, doctor's desk) and as a no-install patient "ticket status" page; weaker for patient features needing reliable background notifications and exact local medication alarms on Android (web push depends on browser/FCM; no exact alarms) — inference.

### Gaps
- No independent RTL rendering comparison; no measurement on Android Go devices common in Syria.
- Shorebird/EAS pricing and availability to Syria-based developer accounts not verified (Google/Expo account sanctions posture unknown).

---

## 9. Realistic AI features in 2026 (Arabic STT/ambient scribe for Levantine, no-show prediction, WhatsApp booking chatbot, lab OCR)

### Takeaway
Off-the-shelf Whisper performs poorly on Levantine dialect zero-shot (WER often 50–70%+) but dialect fine-tuning roughly halves errors; no medical-domain Levantine benchmark exists, so an ambient scribe must be piloted with doctor review. No-show prediction is well-studied (AUC ~0.75–0.95) but its operational benefit via overbooking is unproven. A WhatsApp booking bot is blocked for +963 users by Meta policy (see §5) and general-purpose chatbots are barred by WhatsApp terms since Oct 2025.

### Cited Findings
- Zero-shot Whisper on Arabic dialects: Jordan WER/CER 72.80/58.95; Palestine 51.92/19.42. — [N-Shot Benchmarking of Whisper on Arabic (arXiv 2306.02902)](https://arxiv.org/pdf/2306.02902)
- Levantine children's speech: best Whisper (Large v3) WER 66%, 4.1× worse than its adult benchmark (FLEURS). — [Arabic Little STT (arXiv 2510.23319)](https://arxiv.org/pdf/2510.23319)
- NADI 2025 shared task: dialect-specific adaptation reduced Whisper WER from 93.89 to 39.78 (multi-dialect). — [ACL Anthology 2025.arabicnlp-sharedtasks.103](https://aclanthology.org/2025.arabicnlp-sharedtasks.103.pdf)
- Fine-tuning on MASC across 5 dialects incl. Levantine: dialect-pooled models only 8.42% average WER increase vs dialect-specific. — [Univ. of Groningen thesis](https://campus-fryslan.studenttheses.ub.rug.nl/464/1/MA-3951731-OT-Ozyilmaz.pdf)
- Community multi-dialect Whisper fine-tune (incl. Levantine Lebanese/Syrian): WER 0.358 vs 0.717 zero-shot Whisper-medium on held-out (non-medical) set. — [Hugging Face: whisper-large-v3-arabic-dialectal-v2](https://huggingface.co/oddadmix/whisper-large-v3-arabic-dialectal-v2)
- New dialectal Arabic ASR dataset (Bulbul) published 2026. — [arXiv 2608.21950](https://arxiv.org/pdf/2608.21950) (not reviewed in detail)
- No-show ML AUC 0.75–0.95; overbooking effect uncertain. — [KU review abstract](https://khazna.ku.ac.ae/en/publications/predicting-patient-no-shows-using-machine-learning-a-comprehensiv/); [PMC9933067](https://pmc.ncbi.nlm.nih.gov/articles/PMC9933067)
- WhatsApp barred general-purpose AI chatbots (terms change Oct 2025). — [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform)

### Inferences
- **Realistic 2026 roadmap**: (1) Arabic search normalization + specialty synonym matching (no ML needed); (2) rule-based no-show risk flag → model after 6–12 months of tenant data; (3) **voice-note dictation** for doctors (short notes, prescription instructions) with a dialect-fine-tuned Whisper and mandatory doctor edit, before attempting full ambient scribing; Syrian medical speech is heavily code-switched with English/French drug and disease terms, which needs a custom eval set; (4) lab-report OCR to extract values from printed Arabic/English lab PDFs/photos with human confirmation (no evidence gathered — treat as experimental); (5) booking chatbot on Telegram or in-app rather than WhatsApp until Meta eligibility changes.
- Hosting STT models on-prem/edge is impractical on clinic hardware; cloud inference requires connectivity and sanctions-compliant vendors (inference).

### Gaps
- No medical-domain Levantine/Syrian Arabic ASR benchmark; no evaluation of commercial Arabic ambient scribes found.
- Lab report OCR accuracy for Arabic/English mixed lab reports not researched.
- No data on Telegram adoption in Syria.
