# WhatsApp (unofficial), SMS-free phone verification and FCM push for a clinic SaaS in Syria (Aleppo/Azaz)

Research date: 2026-11-07. All findings are web-sourced. Product-owner decisions taken as given: (1) no official WhatsApp Business Platform for Syria, so an unofficial WhatsApp Web library will be used; (2) no SMS at all; (3) FCM works in Syria/Azaz (owner-confirmed, not independently verified here).

---

## 1. Which unofficial WhatsApp library/gateway to use (Baileys, whatsapp-web.js, WPPConnect, Evolution API, WAHA)?

### Takeaway
As of Nov 2026, the strongest fit for a multi-tenant clinic SaaS is **self-hosted WAHA** on a websocket engine (GOWS or NOWEB). Since **WAHA 2026.6.1 (21 Jun 2026)**, all former "Plus" features ship free in the public image: unlimited sessions, media, PostgreSQL/MongoDB/S3 session storage, API-key auth, and health/metrics endpoints. WAHA can also switch engines if one breaks after a WhatsApp change. Baileys (MIT) is the underlying workhorse but is a library, not a gateway, and v7 is still RC-only. Evolution API is capable, but its **2.4.0 RCs (May 2026) add mandatory activation against a vendor licensing server** and its license adds a usage-notice condition, which are business-continuity risks for a SaaS.

### Cited Findings
**Baileys (WhiskeySockets)**
- MIT license, "Copyright (c) 2026 Rajeh Taher/WhiskeySockets". Rajeh is named as current maintainer. About 11.6k stars, 3.5k forks, 288 open issues and 47 open PRs at fetch time. Docs live at baileys.wiki ("work in progress"), with a migration guide at whiskey.so/migrate-latest — [GitHub WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- The maintainers "do not in any way condone the use of this application in practices that violate the Terms of Service of WhatsApp" and "discourage any stalkerware, bulk or automated messaging usage" — [GitHub WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- Release history:
  - The latest tag is **v7.0.0-rc14 (29 Jul 2026)**, alongside legacy **v6.7.24 (29 Jul 2026)**. **v7.0.0 final is not released.**
  - rc10 (6 May 2026) was the "largest release so far". It fixed connection deadlocks, memory leaks and ghost sessions, added LID<->PN (phone-number) mappings, and added handling for the **463 "Reachout Timelock"** restriction.
  - rc12 (20 May 2026) patched security advisory GHSA-qvv5-jq5g-4cgg.
  - rc13 (21 May 2026) fixed a regression where `fromMe` was set wrongly "after a WhatsApp node behavior change". This is a concrete example of breakage caused by a WhatsApp-side change.
  - 6.7.21 (6 Nov 2025) was a pairing-issue hotfix.
  - v7 introduced ESM and breaking changes.
  - [Baileys releases](https://github.com/WhiskeySockets/Baileys/releases)
- The rc10 notes say there had been no release since 21 Nov 2025 (a ~5.5-month gap). They also say v7 would follow weekly patch and biweekly minor releases once final — [newreleases.io rc10](https://newreleases.io/project/github/WhiskeySockets/Baileys/release/v7.0.0-rc10)
- A third-party guide says the npm "stable" dist-tag was 6.7.23 in May 2026, with 7.x published only as RCs. Version numbers across aggregators disagree, so verify on npm — [checkleaked.cc](https://whatsapp.checkleaked.cc/fr/blog/what-is-baileys)

**whatsapp-web.js (pedroslopez)**
- Apache-2.0, about 22.9k stars, Node >= 18. It drives the real WhatsApp Web in a Puppeteer-managed browser, and the README claims this "reduces the risk of being blocked".
- Its own disclaimer says "it is not guaranteed you will not be blocked" and that WhatsApp does not allow bots or unofficial clients.
- Buttons and lists are marked deprecated, and sending video requires Google Chrome.
- [GitHub pedroslopez/whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- Resource use: roughly **200–500 MB RAM per session** (Chromium), per a competing library's comparison page. That page is marketing, so treat the figure as an estimate — [whatsmeow-node docs](https://nicastelo.github.io/whatsmeow-node/docs/guides/integrate-whaticket). Generic Puppeteer anecdotes put it at 500 MB–1 GB per instance — [Latenode forum](https://community.latenode.com/t/hardware-specs-needed-for-puppeteer-automation/23747)

**WPPConnect**
- WPPConnect Server has an official Docker image, release tags that track GitHub/npm, and a `/healthz` endpoint — [wppconnect-server](https://github.com/wppconnect-team/wppconnect-server)
- Its browser-injection layer wa-js showed a last update of 26 Sep 2024 in a stale GitHub org snapshot — [wppconnect-team org](https://github.com/wppconnect-team). A June 2026 third-party guide claims wa-js v4.3.1 (Apache-2.0) — [checkleaked.cc WPPConnect guide](https://whatsapp.checkleaked.cc/ko/blog/wppconnect-guide). The 2026 maintenance status is therefore unconfirmed.

**WAHA (devlikeapro)**
- Engines:
  - **WEBJS** (Puppeteer, default, broadest features) and **WPP** (Puppeteer) both need Chromium.
  - **NOWEB** (Node/TypeScript websocket) needs no browser and "saves CPU and memory". Chats, contacts and messages require enabling the Store.
  - **GOWS** (Go websocket) needs no browser and is described as the "future replacement for NOWEB".
  - Message ack events, send text and group endpoints are supported on all four engines.
  - [WAHA engines doc](https://waha.devlike.pro/docs/how-to/engines)
- **2026.6.1 (announced 21 Jun 2026):**
  - "every feature that used to need a Plus subscription ships in the free, public image". That covers unlimited sessions, media sending, PostgreSQL/MongoDB/S3 storages, API key and Swagger auth, and health-check and metrics endpoints.
  - Use the `devlikeapro/waha` image instead of `waha-plus`.
  - The only remaining paid option is a symbolic $5/month "Community" tier with no perks.
  - [WAHA 2026.6 blog](https://waha.devlike.pro/blog/waha-2026-6/)
- Before 2026.6.1, Core was limited to one session and Plus cost about $19–21/month — [WAHA pricing (historical)](https://waha.devlike.pro/pricing); [Boosty](https://boosty.to/wa-http-api)
- A third-party deploy template reports about **250 MB RAM for GOWS** and says **sessions are not portable between engines** (switching engine means re-linking by QR) — [Railway WAHA GOWS template](https://railway.com/deploy/waha-production?referralCode=sLjDXb). A third-party listing also describes GOWS as the lightest engine — [awesome.ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fdevlikeapro%2Fwaha)
- WAHA docs describe WhatsApp-side error codes surfaced to the API:
  - **463 "Reachout Timelock"**: a shadow restriction on messaging new contacts. The session stays `WORKING`.
  - **475 "CAPPED"**: a per-cycle quota on new contacts, preceded by `FIRST_WARNING` and `SECOND_WARNING`.
  - [WAHA how to avoid blocking](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/)

**Evolution API (Evolution Foundation)**
- License: Apache 2.0 **plus extra conditions**. (a) You may not remove or modify the LOGO or copyright in the console or frontend (this does not apply if the frontend isn't used). (b) If used in any project, including closed source, "the user is required to display a clear notification within the system that Evolution API is being utilized", visible to admins and in documentation. Non-compliance "may result in the necessity for a commercial license" — [Evolution API LICENSE](https://github.com/EvolutionAPI/evolution-api/blob/main/LICENSE)
- A fork's README describes a condition barring multi-tenant SaaS use without written permission — [kleytonbarcelos/evolution-api](https://github.com/kleytonbarcelos/evolution-api). The current upstream LICENSE fetched on 2026-11-07 does **not** contain that clause, so the two conflict.
- Features: about 10.1k stars, Docker image `evoapicloud/evolution-api`. It supports both Baileys (unofficial) and the official Cloud API. Integrations include webhooks (with signature validation), RabbitMQ, Kafka, SQS, Socket.io, Chatwoot, Typebot, n8n/Flowise/Dify, and S3/MinIO — [GitHub EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api)
- Releases:
  - v2.3.7 (05 Dec; year not shown, most likely 2025) is marked "Latest".
  - **2.4.0-rc1 (6 May 2026)** is a breaking change: "every Evolution API instance must be activated against the" Evolution Foundation licensing server. Unactivated business endpoints return **HTTP 503 `LICENSE_REQUIRED`**, and rc1 sends a heartbeat every 30 min. rc2 (17 May 2026) added headless auto-activation via `EVOLUTION_OPERATOR_EMAIL`.
  - The notes say nothing about free vs paid tiers.
  - Fixes in 2.3.5–2.4.0 include LID (`@lid`) contact handling, "incoming message events stopping after reconnection", and zombie instances after a failed logout. The bundled Baileys moved from 7.0.0-rc.5 to rc.9.
  - [Evolution API releases](https://github.com/evolution-foundation/evolution-api/releases)

### Inferences
- **Recommendation: WAHA (latest 2026.x image, pinned), GOWS engine by default with NOWEB as fallback, PostgreSQL session storage, API key on.**
  - Free unlimited sessions remove the old per-instance cost.
  - The engine abstraction means that when a WhatsApp change breaks one library, sessions can move to another engine. That costs a re-link, but no rewrite of application code.
  - Websocket engines avoid running one Chromium per clinic, which matters with many clinics on one VPS.
- **Baileys direct** is the alternative if the team wants full control and MIT licensing. The cost is owning reconnection, LID mapping, store and webhook plumbing. v7 is still RC, and there was a 5.5-month release gap in late 2025 to May 2026.
- **Evolution API** is technically rich (multi-instance, queues, Chatwoot). However, the 2.4 licensing-server gate means a vendor-side outage or policy change could return 503 for every clinic. The usage-notice clause must also be honored. If chosen, pin 2.3.x and track the license terms.
- **whatsapp-web.js / WPPConnect / WAHA-WEBJS** carry a Chromium-per-session cost. That is unattractive for dozens of clinics on modest hardware, but they are useful as a fallback engine if websocket protocols break.
- Every option breaks periodically on WhatsApp protocol changes (Baileys rc13 is one example). Budget for monitoring upstream releases and patching within days.

### Gaps
- The WAHA code license (Apache-2.0 or other) was not stated on the pages fetched. Check the `devlikeapro/waha` repo LICENSE before committing.
- No independent benchmark of GOWS/NOWEB RAM per session at scale was found. The 250 MB figure is a third-party claim.
- Whether Evolution API 2.4 final requires a paid license for SaaS is unknown. The release notes don't mention pricing.
- No current (2026) primary-source star count or release date was found for WPPConnect wa-js.

---

## 2. Legal/ToS reality and Meta enforcement (2025–2026)

### Takeaway
Automating a consumer or WhatsApp Business **app** account through an unofficial client clearly violates WhatsApp's Terms. WhatsApp's own FAQ warns that linking through unofficial apps "may result in a temporary or permanent account ban". Enforcement is heuristic and unpredictable rather than a published rule set. Since Oct 2025 WhatsApp has also been rolling out caps on messages to people who don't reply. Meta still lists Syria as ineligible for the official Business Platform, but **Türkiye has been eligible since May 2024**, which matters for Azaz.

### Cited Findings
- The WhatsApp Terms of Service (Effective 4 Jan 2021, the version served on 2026-11-07) prohibit:
  - "bulk messaging, auto-messaging, auto-dialing"
  - "any non-personal use of our Services unless otherwise authorized by us"
  - using the services "in impermissible or unauthorized manners", including access "through automated or other means"
  - "create accounts … through unauthorized or automated means"
  - reverse engineering

  Penalties: WhatsApp "may take action with respect to your account, including disabling or suspending your account" and may "terminate your access … anytime for any reason" — [WhatsApp Terms of Service](https://www.whatsapp.com/legal/terms-of-service)
- WhatsApp's linked-devices FAQ says "Linking through unofficial apps or websites may result in a temporary or permanent account ban" — [WhatsApp Help Center](https://faq.whatsapp.com/378279804439436)
- Meta's Business Platform support page (updated 19 Nov 2025) says businesses in Cuba, Iran, North Korea, **Syria** and occupied Ukrainian regions are not eligible. **Türkiye is no longer restricted for Cloud API as of 15 May 2024** — [Meta WhatsApp Business Platform support](https://developers.facebook.com/documentation/business-messaging/whatsapp/support); [Deskpro country restrictions](https://support.deskpro.com/en-US/guides/admin-guide/channels/whatsapp/whatsapp-country-restrictions)
- US Executive Order 14312 revoked the Syria sanctions program effective 1 Jul 2025, leaving targeted sanctions in place (secondary source) — [ClefinCode](https://www.clefincode.com/blog/global-digital-vibes/en/from-isolation-to-integration-sanctions-lifting-on-syria-the-global-rise-of-syrian-expertiseandmarketpotential). No Meta announcement restoring Syria eligibility was found.
- In Oct 2025 WhatsApp announced it would test a **monthly cap on messages that individuals and businesses send to people who don't respond**. The limit size and test countries were not disclosed. Accounts nearing the cap get a warning — [TechCrunch, 17 Oct 2025](https://techcrunch.com/2025/10/17/whatsapp-will-curb-the-number-of-messages-people-and-businesses-can-send-without-a-response)
- WAHA's `FIRST_WARNING` → `SECOND_WARNING` → `CAPPED` (475) and the 463 "Reachout Timelock" errors look like the API-visible form of this. Its docs say not to restart or re-pair because that doesn't reset the quota — [WAHA how to avoid blocking](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/)
- Meta said it banned **6.8 million** WhatsApp accounts linked to scam centers in H1 2025 — [TechRepublic](https://www.techrepublic.com/article/news-whatsapp-scams-meta/)
- Litigation history: WhatsApp sued Rockey Tech (N.D. Cal. 4:22-cv-05711, 2022) over unofficial apps, including commercial spam — [Docket Alarm](https://www.docketalarm.com/cases/California_Northern_District_Court/4--22-cv-05711/WhatsApp_LLC_et_al_v._Rockey_Tech_HK_Ltd._et_al/1/)
- In an earlier (2015) crackdown, users of third-party clients were temporarily banned. WhatsApp said there was "no permanent ban" — [TechCrunch](https://techcrunch.com/?p=1128480)
- Developer and vendor blogs (2026) describe detection as heuristic/ML-based. One says "one account runs clean for months; another gets banned within a week doing the same thing" — [checkleaked.cc avoid ban](https://whatsapp.checkleaked.cc/blog/avoid-whatsapp-ban). A compliance vendor claims bans increasingly come with no warning since H2 2025, without a primary citation — [achiya-automation](https://achiya-automation.com/en/blog/whatsapp-spam-detection-2026/)
- Meta prohibited general-purpose AI chatbots on the Business Platform effective 15 Jan 2026. This is tangential, but it is pushing some developers to unofficial libraries — [Zylos research](https://zylos.ai/research/2026-01-26-whatsapp-api-automation)

### Inferences
- **Business continuity:** treat every WhatsApp session as revocable at any time without appeal. The product must work fully without WhatsApp, with push and the in-app inbox as primary, and WhatsApp as a convenience channel.
- Meta's legal actions found target abusive vendors (spam, scraping, account theft), not clinics sending reminders to their own patients. The realistic risk is **number bans**, not lawsuits. That still makes a contractual clause in clinic onboarding prudent: the clinic owns its number, consents to the risk, and accepts that the platform cannot guarantee delivery.
- **Azaz option:** many Azaz residents and businesses use Turkish +90 lines, and Türkiye is eligible for the official Cloud API. A Turkish-registered legal entity could later move OTP and reminders to the **official Cloud API with templates**, removing ban risk for the platform number. This needs legal validation of entity location, payment method and Meta business verification.

### Gaps
- A Nov 2026 search result titled "Meta sues app dev to steal over one million WhatsApp accounts" (cybersecuritynews.com) could not be fetched (connection reset). Its date and details are unverified.
- No official Meta statement was found on 2026 ban waves specifically targeting Baileys or WhatsApp Web automation. Claims to that effect are vendor-sourced only.
- The size of the "unanswered messages" cap and whether it applies in Syria or Türkiye are not disclosed.

---

## 3. Responsible-use practices to keep ban risk low

### Takeaway
Ban risk is driven mainly by **spam signals**: user reports and blocks, messages to people who never replied or didn't save the number, identical bulk content, and robotic timing. Transactional messages to patients who **messaged the clinic first** (or saved its number), paced at human-like rates, are the lowest-risk pattern. Account hygiene matters too: a real business profile, a phone that stays online, and stable sessions.

### Cited Findings
- WAHA's official guidance:
  - "Never initiate conversations". Reply only, and use a `wa.me` link with prefilled text so users start the chat.
  - Before each send: send "seen", then typing, a random delay proportional to message length, then the message.
  - Vary wording (for example, the recipient's first name).
  - Random 30–60 s gaps between messages.
  - Don't message 24/7. Their example is up to 4 messages per replying contact within an hour, then pause an hour.
  - Set profile picture, name and status before messaging new people.
  - Avoid spam-flagged and non-HTTPS links.
  - Short single first messages.
  - WAHA claims that being tagged as spam 5–10 times leads to a ban and that a points-like reputation exists; it notes these figures are not WhatsApp-verified.
  - On 463/475 errors, stop outreach to new contacts and do not re-pair.
  - [WAHA how to avoid blocking](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/)
- Linked-device constraints (official):
  - Up to **4 linked devices** per phone.
  - Linked devices work without the phone online but **log out if the phone goes unused for more than 14 days**.
  - Linked devices are disconnected after **30 days of inactivity**.
  - The primary phone is required to link new devices.
  - [WhatsApp Help Center](https://faq.whatsapp.com/378279804439436)
- Other logout causes cited by a gateway provider include reinstalling WhatsApp, moving the account to another phone, and "suspicious activity" detection — [Green API FAQ](https://green-api.com/en/docs/faq/why-does-the-crash-happen)
- WhatsApp's unanswered-messages cap counts messages to people who don't respond — [TechCrunch](https://techcrunch.com/2025/10/17/whatsapp-will-curb-the-number-of-messages-people-and-businesses-can-send-without-a-response)
- Detection is non-deterministic, so the same behavior gets different outcomes on different accounts — [checkleaked.cc](https://whatsapp.checkleaked.cc/blog/avoid-whatsapp-ban)

### Inferences
Policy defaults for the MVP. These are engineering judgment, not WhatsApp-published limits.
- **Consent-first:** a patient only becomes "WhatsApp-reachable" for a clinic after the patient has sent at least one message to that clinic's number. Patients do this by scanning a reception-desk QR or tapping a `wa.me/<clinic>?text=...` link in the app or on the booking confirmation. Store `wa_opt_in_at` and `last_inbound_at` per (clinic, patient).
- **Message types:** only transactional messages (booking confirmation, reminder 24 h and/or 2 h before, reschedule or cancel notices, "your results are ready, open the app"). No marketing broadcasts in the MVP.
- **Throttle per number:** single-worker queue per session. Random 20–60 s gap between sends, typing indicator, at most ~30–60 sends per hour per clinic number, quiet hours (for example 21:00–08:00 local). Spread reminder jobs across the day instead of firing all reminders at 09:00.
- **Content variation:** templates with the patient name, doctor, time and clinic name, plus 3–5 phrasing variants. No links in the first message to a new contact. One HTTPS link to the platform domain is acceptable later.
- **Opt-out:** recognize keywords in Arabic and English (`إيقاف`, `stop`), stop WhatsApp sends immediately, and confirm once.
- **Account hygiene:**
  - Clinics should use the **WhatsApp Business app** on a dedicated phone with a complete business profile.
  - The number should be an existing, aged number with real conversation history rather than a freshly registered SIM.
  - The phone must be kept charged and online at least weekly (14-day rule).
  - Don't use a 5th linked device.
  - Pause automatically on 463/475 or warning events.
- **Platform OTP number:** keep it separate from clinic numbers, use an aged number with a business profile, and have it mainly **receive** messages (see the reverse-OTP design in section 5).

### Gaps
- No primary-source per-number daily limit exists. All numeric limits above are community or vendor folklore or engineering defaults.
- No data was found on whether WhatsApp treats Syrian (+963) or Turkish (+90) numbers differently for spam scoring.
- Whether the WhatsApp Business app materially lowers ban risk compared with a personal account when used via a linked device was not established by any primary source. It is commonly recommended but unproven.

---

## 4. Architecture: sessions, queueing, receipts, health, QR re-link, fallback

### Takeaway
Use one gateway session per clinic number (plus one platform OTP session) behind your own "messaging service". That service owns per-session queues with throttling, idempotency, webhook ingestion (inbound messages, acks, session-status changes), health alerts to clinic admins, and a self-service QR re-link page. Every notification has a **fallback ladder** that does not depend on WhatsApp.

### Cited Findings
- WAHA 2026.6.1 provides unlimited sessions, PostgreSQL/MongoDB/S3 storages for session state, API-key security, and health/metrics endpoints in the free image — [WAHA 2026.6 blog](https://waha.devlike.pro/blog/waha-2026-6/)
- Message ack events are supported on WEBJS, WPP, NOWEB and GOWS. NOWEB needs its Store enabled for chat and message retrieval. The MongoDB session store is deprecated (WEBJS/WPP) — [WAHA engines](https://waha.devlike.pro/docs/how-to/engines)
- During restrictions (463/475) sessions remain `WORKING` while sends fail. Restarting or re-pairing doesn't help — [WAHA how to avoid blocking](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/)
- Evolution API 2.3.7 fixed "incoming message events stopping after reconnection" and an "authenticated but couldn't send" state. 2.4.0-rc1 fixed zombie instances after logout failure — [Evolution API releases](https://github.com/evolution-foundation/evolution-api/releases). This shows the classes of failures a health monitor must catch.
- WhatsApp now uses **LIDs** (`@lid` identifiers) in place of phone numbers in some contexts:
  - Baileys v7 added LID<->PN mapping — [Baileys releases](https://github.com/WhiskeySockets/Baileys/releases)
  - Evolution 2.4 added `@lid` → phone JID translation with caching, after sends to `@lid` contacts were being rejected — [Evolution API releases](https://github.com/evolution-foundation/evolution-api/releases)
- Linked devices log out if the phone is unused for more than 14 days, and are disconnected after 30 days of inactivity — [WhatsApp Help Center](https://faq.whatsapp.com/378279804439436)

### Inferences
Proposed components:
1. **Gateway layer:** WAHA container(s) with GOWS, Postgres session storage and an API key. The private network is reachable only from the backend. Run sessions for, say, 20–50 clinics per container, and shard by clinic ID when growing. Keep the **platform OTP session in a separate container**, ideally on a separate egress IP, so a clinic-number incident doesn't degrade OTP and vice versa. The IP separation is a precaution, not a sourced requirement.
2. **Messaging service (your backend):**
   - An `outbound_messages` table with states queued → sending → sent → delivered → read, or failed/fallback.
   - A Redis/BullMQ-style queue **keyed by session**, with concurrency 1, randomized delays, quiet hours and a per-hour cap.
   - An idempotency key per (appointment, reminder type).
3. **Webhook ingestion:**
   - Inbound messages: opt-in capture, opt-out keywords, reverse-OTP codes.
   - `message.ack` events: delivered/read updates.
   - Session-status events: map statuses such as WORKING, SCAN_QR, FAILED and STOPPED to clinic-visible state.
   - Resolve `@lid` senders to phone numbers before matching patients.
4. **Health monitor:**
   - Every few minutes, check gateway health/metrics and session status.
   - Track error codes 463/475 and warnings → auto-pause outbound for that session for 24 h and notify the clinic admin.
   - Track "no acks in N hours despite sends" as a silent-failure detector.
   - Remind the clinic if its phone hasn't been seen for about 10 days (before the 14-day logout).
5. **QR re-link flow:**
   - A clinic-admin page showing the session state and a live QR (polled from the gateway).
   - Instructions in Arabic: WhatsApp → Linked devices → Link a device.
   - Optional pairing-code flow if the gateway supports it.
   - Audit-log who re-linked and when.
   - Never auto-re-pair on restriction errors.
6. **Fallback ladder per notification:**
   - (a) **FCM push + in-app inbox** for patients with the app. This should be the primary channel because it is free and carries no ban risk.
   - (b) **WhatsApp via the clinic session** for opted-in patients.
   - (c) If the session is down or the message failed, the receptionist dashboard shows a **"send manually" button** that opens `wa.me/<patient>?text=<prefilled reminder>` on the clinic's own phone or WhatsApp Web. A human sends it, so there is no automation and no ban risk.
   - (d) A phone-call task list for elderly patients without the app.

### Gaps
- Exact WAHA webhook event names and session-status enum values for the 2026.x versions were not fetched. Confirm them in the WAHA docs before implementation.
- No per-container session-density benchmark (sessions per GB RAM for GOWS) was found.
- Whether LID-only senders (no resolvable phone number) occur in 1:1 chats with clinic numbers in 2026, and how often, is not quantified.

---

## 5. Phone verification without SMS

### Takeaway
The best SMS-free primary method is **user-initiated ("reverse") WhatsApp verification**. The app shows a one-time code and opens `wa.me/<platform number>?text=<code>`, the user taps Send, and the backend matches the code to the sender's number. The user messages first, so it barely adds ban risk, and it also creates the conversation needed to reply. **Telegram Gateway** ($0.01 per delivered code, official API) is a good secondary channel for users who have Telegram. **In-person verification at reception** is the inclusive fallback for elderly users. Google Sign-In can be added as an identity option but does not prove phone ownership.

### Cited Findings
**WhatsApp**
- WAHA explicitly recommends the `wa.me` link with prefilled text so "users can start the chat themselves", and says to never initiate — [WAHA how to avoid blocking](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/)
- WhatsApp's unanswered-messages cap penalizes outbound messages to people who don't respond. Classic outbound OTP to new numbers is exactly that pattern — [TechCrunch](https://techcrunch.com/2025/10/17/whatsapp-will-curb-the-number-of-messages-people-and-businesses-can-send-without-a-response)
- WhatsApp account-takeover scams rely on victims forwarding 6-digit codes ("sent to you by mistake") or reading out OTPs, including attackers choosing "send OTP via phone call" during WhatsApp registration — [Security Affairs](https://securityaffairs.com/131807/hacking/whatsapp-otp-scam.html); [Dubawa](https://dubawa.org/how-whatsapp-scammers-circumvent-security-features-to-swindle-nigerians/)
- LID identifiers can replace phone numbers in events. Gateways added LID→PN mapping, so reverse-OTP must resolve the sender to a phone number — [Baileys releases](https://github.com/WhiskeySockets/Baileys/releases); [Evolution API releases](https://github.com/evolution-foundation/evolution-api/releases)

**Telegram Gateway**
- Sends verification codes to the user's Telegram account at **$0.01 per code**, with an automatic refund if the code isn't delivered within the TTL. Funds are prepaid credits. Recipients must have a Telegram account and must have shared their number with you — [Telegram Gateway](https://core.telegram.org/gateway)
- API details:
  - `sendVerificationMessage` takes code (4–8 digits) or `code_length`, `ttl` 30–3600 s (changed 26 Feb 2025), `callback_url` and `sender_username` (a verified channel).
  - `checkSendAbility` charges if the code can be sent, after which the send with the same `request_id` is free. It is free and returns an error if the code can't be sent.
  - Statuses: sent, delivered, read, expired, revoked. Verification statuses: code_valid, code_invalid, code_max_attempts_exceeded, expired.
  - Callbacks are signed with HMAC-SHA-256 keyed by SHA256(api_token).
  - Sends to your own number are free.
  - [Telegram Gateway API](https://core.telegram.org/gateway/api)
- Terms of Service:
  - Gateway "may not be available … within certain geographical regions".
  - Payment for credits is processed by **Fragment**, and you must verify that your cryptocurrency use is legal.
  - Credits are non-refundable and expire after 3 years.
  - Prices may vary by the recipient's country code.
  - Unsolicited messages are forbidden.
  - [Telegram Gateway ToS](https://telegram.org/tos/gateway)
- A reseller (Dexatel) sells Telegram OTP at $0.024 flat per verification — [Dexatel](https://dexatel.com/channels/telegram/)

**Google Sign-In and Google services in Syria**
- Google removed Syria from its OFAC-based restrictions on 13 Aug 2025, starting with ads products — [PPC Land](https://ppc.land/google-removes-syria-from-advertising-sanctions-list-effective-august-2025/)
- In Jan 2026 Syrian officials said Google services were returning, with most platforms expected "within the coming weeks" — [Anadolu Agency](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- Gemini was still reported unavailable without a VPN, so the rollout is uneven — [Enab Baladi](https://www.enabbaladi.net/824230/?amp=1)

**Usage context**
- WhatsApp and Facebook are the most used social channels in Syria (undated source) — [Media Landscapes](https://medialandscapes.org/country/syria/media/social-networks)
- Syria had 9.01M internet users (35.8% penetration) at the start of 2025 — [DataReportal Digital 2025: Syria](https://datareportal.com/reports/digital-2025-syria)

### Inferences
Comparison:

| Method | Proves | Ban/ops risk | Cost | UX (elderly) | Main attack |
|---|---|---|---|---|---|
| **Reverse WhatsApp OTP** (user sends code via wa.me) | Control of the WhatsApp account registered to that number on that device | Low: user initiated, platform only replies | ~0 | Good: one tap on "Send" in a familiar app | Social engineering ("send this message for me"). Hijacked WhatsApp account passes. |
| Outbound WhatsApp OTP (platform → user) | Same | **High**: unsolicited messages to new contacts count toward caps and 463/475 errors, and the number gets reported | ~0 | Good | Code forwarding scams |
| Telegram Gateway | Control of the Telegram account for that number | None for WhatsApp; Telegram may geo-restrict | $0.01/delivered code, prepaid via Fragment (crypto) | Medium: many elderly users lack Telegram | Hijacked Telegram account |
| Reception desk in-person (staff scans patient's app QR, checks ID or the patient's phone) | Physical presence plus staff judgment | None | Staff time | **Best for elderly** | Insider or staff error |
| Google Sign-In | Email identity, not the phone | Google availability in Syria is uneven | Free | Medium | Google account takeover |
| Flash/missed call | SIM | Needs a telecom/CPaaS route; conflicts with the "no SMS/telecom" stance | n/a | Good | SIM swap |

- **Reverse-OTP design details:**
  - The app requests `POST /verify/start` and gets back a nonce (6–8 chars, TTL ~10 min, bound to the app install and a device key).
  - The app opens `https://wa.me/<platformNumber>?text=رمز التحقق: ABC123 – أؤكد تسجيل الدخول إلى تطبيق شفاء على جهازي` ("Verification code: ABC123 – I confirm signing in to the Shifa app on my device"). The prefilled text explicitly says it is for the user's own device, to blunt "send this for me" scams.
  - On inbound, resolve `@lid` to a phone number, match the nonce, and check that the sender number equals the number the user typed. Optionally skip typing the number at all and take the sender's number as the verified number.
  - Then mark the account verified and push the result to the app via FCM or a websocket/long-poll, and send a short WhatsApp reply ("تم التحقق ✅", "Verified") inside the now-open conversation.
  - Rate-limit per device and per number.
  - Add a fallback "didn't work?" path → Telegram Gateway → reception desk.
- SIM-swap and account-takeover exposure is similar for every phone-bound factor. For a clinic app the higher-value protection is **device binding**: refresh tokens tied to the device key, re-verification on a new device, and staff-assisted recovery. That matters more than which channel delivered the code.
- The same reverse-OTP step can double as **WhatsApp opt-in for the platform**. A "send to clinic" variant (wa.me to the clinic's number) gives clinic-level opt-in for reminders.
- Telegram Gateway's crypto-based payment via Fragment may be hard for a Syrian company to fund. Validate before relying on it.

### Gaps
- Whether Telegram Gateway delivers to +963 or +90 numbers (any regional restriction) and the per-country price for those codes. Neither is published. Test with `checkSendAbility` and ask @GatewaySupport.
- Telegram's adoption rate in Aleppo/Azaz (especially among older patients) is unknown. No Syria-specific messaging-share data was found.
- Firebase Authentication and Google Sign-In availability from Syrian IPs in Nov 2026 is not confirmed by any source found.
- No source documents whether WhatsApp throttles inbound-heavy accounts. Reverse OTP is assumed low-risk by reasoning from WAHA's "user initiates" guidance, not from a published rule.

---

## 6. FCM reliability on common Android phones in Syria (Samsung, Xiaomi/Redmi/POCO, Oppo/Realme, Tecno/Infinix, Huawei without GMS)

### Takeaway
Use FCM **user-visible, high-priority messages** (named `RemoteNotification` in the newer `AndroidConfigV2` API) for appointment events. Always show a notification so FCM doesn't deprioritize future high-priority messages. Request the Android 13+ notification permission at a meaningful moment, and post to your own high-importance channel. Guide users on aggressive OEM battery managers (Xiaomi, Samsung, Huawei, Oppo, Tecno), measure delivery with FCM's aggregated delivery data, and add **Huawei Push Kit** only for Huawei devices without Google services. The in-app inbox is the source of truth, with push as a hint.

### Cited Findings
**Priority and deprioritization**
- High priority can wake a sleeping device and should "result in user interaction". If high-priority messages don't produce user-visible notifications, FCM may lower them to normal priority, evaluated over **7 days per app instance**. Disabled notification permission also leads to deprioritization — [Firebase message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority)
- For extra work after a high-priority message, use an expedited WorkManager job. A brief exemption from expedited-job quotas applies — [Firebase message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority)
- Android docs: FCM "v1 … used high priority messages whereas v2 uses `RemoteNotification` for user facing, time-sensitive notifications and `BackgroundSync` for non-urgent messages". Use RemoteNotification for notifications that must be seen in Doze. Put enough data in the payload that no follow-up network call is needed — [Android Doze & App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)

**Battery exemptions**
- Google Play policy prohibits requesting direct Doze exemption (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) unless the core function is broken. For messaging apps that can use FCM RemoteNotification, the exemption is "Not Acceptable".
- Apps may instead open `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` and check `isIgnoringBatteryOptimizations()`.
- [Android Doze & App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)

**Android 13+ permission and channels**
- Android 13 added a runtime notification permission (POST_NOTIFICATIONS). The FCM SDK 23.0.6+ declares it, but the app must request it — [Firebase Android get started](https://firebase.google.com/docs/cloud-messaging/android/start)
- Time-sensitive notifications need a high-importance channel plus high notification priority — [Android time-sensitive notifications](https://developer.android.com/training/notify-user/time-sensitive)

**OEM battery killers**
- dontkillmyapp ranks Huawei, Xiaomi, OnePlus and Samsung as worst (5/5; Samsung "especially after Android P"), then Oppo (4), and Vivo, realme and Tecno (3). Infinix is not listed. Stock and Android One devices score 0 — [dontkillmyapp.com](https://dontkillmyapp.com/)

**Delivery metrics**
- Sources: the Firebase console Reports tab (sends, received, impressions, opens; needs Analytics), the **Aggregated delivery data API** (no Analytics needed; 7 days of history, delayed up to 5 days), and the BigQuery export.
- Outcomes include delivered, pending, "dropped, too many pending" (limit of **100 pending non-collapsible messages**), "dropped, device inactive" and TTL expired. Delay causes include device offline and throttled.
- Reports include the **% of messages lowered from HIGH to NORMAL**.
- Use `analyticsLabel` (max 100 unique labels/day).
- [FCM understand delivery](https://firebase.google.com/docs/cloud-messaging/understand-delivery)

**Huawei Push Kit**
- Push Kit "pushes messages in real time, even when your app isn't running", with message receipts. It supports Android with HMS, iOS, Web and HarmonyOS — [Huawei Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/)
- SDK routing strategies differ:
  - OneSignal registers FCM if supported, otherwise HMS — [OneSignal](https://onesignal.com/blog/announcing-huawei-hms-support/)
  - Pushwoosh uses HMS only when Google Play services are absent, and FCM takes priority when both exist — [Pushwoosh](https://help.pushwoosh.com/hc/en-us/articles/36024403609117-Huawei-HMS-vs-FCM-GMS-Co-existence-and-Prioritization)
  - Acoustic prefers HMS when both exist. Testing needs a physical Huawei device because the emulator lacks HMS — [Acoustic](https://developer.goacoustic.com/acoustic-connect/docs/enable-push-notifications-in-android-app-huawei)
- In 2026, Huawei phones still lack native GMS. Workarounds such as GBox and GSpace are not equivalent to native GMS — [TechEconomy](https://techeconomy.ng/huawei-phones-without-google-play-store-what-you-can-and-cant-do-in-2026)

### Inferences
Implementation checklist:
- **Send policy:**
  - Send appointment events as user-visible notifications (RemoteNotification / high priority). Every high-priority message must display a notification.
  - Use normal or BackgroundSync for silent syncs.
  - Set a TTL for reminders, for example expiring at the appointment time.
  - Use `collapse_key` per appointment so offline devices don't accumulate stale reminders and hit the 100-pending limit.
- **Client:**
  - Create channels in Arabic at first launch: "مواعيد" ("Appointments", IMPORTANCE_HIGH) and "عام" ("General", default).
  - Request POST_NOTIFICATIONS after the first booking ("to remind you of your appointment") rather than at cold start.
  - Re-check permission and channel status at each app open and report it to the backend. The server then knows the push is unreachable and falls back to WhatsApp or the inbox.
- **OEM guidance screen:**
  - Detect manufacturer and show a short Arabic guide: Xiaomi/Redmi/POCO autostart and "No restrictions" battery; Samsung "Never sleeping apps"; Oppo/Realme "Allow background activity"; Tecno/Infinix "Phone Master" whitelist.
  - Deep-link to `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`.
  - Don't use the direct exemption intent, to stay within Play policy.
- **Token hygiene:** refresh the FCM token on every app open, delete tokens that return UNREGISTERED, and track "last token refresh" per device.
- **Metrics:** label messages (`appt_reminder_24h`, `appt_confirmed`, `otp_result`), pull aggregated delivery data weekly, and alert if "priority lowered" or "dropped device inactive" rise.
- **Huawei:**
  - Add Push Kit only if analytics show a meaningful share of non-GMS Huawei/Honor devices among patients.
  - Use a "GMS available? → FCM; else HMS available? → Push Kit; else in-app polling + WhatsApp" rule.
  - Distribution for those users is via AppGallery or direct APK.
- Push remains best-effort on aggressive OEMs. The **in-app inbox fetched on app open** plus WhatsApp for opted-in patients gives the needed redundancy.

### Gaps
- No market-share data was found for Android brands in Syria or Azaz specifically. Brand prevalence is assumed from the brief.
- FCM delivery rates for Syrian networks are not published. The owner's confirmation that FCM works is the only evidence here.
- Huawei Push Kit's availability and AppGallery Connect developer registration for Syria- or Türkiye-based developers was not verified.
- Infinix (Transsion) is not rated on dontkillmyapp. Tecno's rating (3) is the nearest proxy.

---

## 7. Recommended MVP design (synthesis)

### Takeaway
Make **FCM push + in-app inbox** the primary patient channel, and **WhatsApp (via self-hosted WAHA, GOWS engine) a consent-based secondary channel per clinic**, with a manual `wa.me` fallback for receptionists. Verify phones mainly by **user-initiated reverse WhatsApp OTP** on a separate platform number, with Telegram Gateway and in-person reception verification as fallbacks. Never depend on WhatsApp for anything that must not fail.

### Cited Findings
- WAHA free image (2026.6.1+) supports unlimited sessions, Postgres storage, API key and health/metrics — [WAHA 2026.6 blog](https://waha.devlike.pro/blog/waha-2026-6/)
- WAHA recommends user-initiated chats via wa.me and human-like pacing; error codes 463/475 indicate restrictions — [WAHA how to avoid blocking](https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/)
- Unofficial linking risks temporary or permanent bans; the phone must be active within 14 days; maximum 4 linked devices — [WhatsApp Help Center](https://faq.whatsapp.com/378279804439436)
- Telegram Gateway costs $0.01 per delivered code, with refunds on non-delivery and signed callbacks — [Telegram Gateway API](https://core.telegram.org/gateway/api)
- FCM deprioritizes high-priority messages that don't show notifications, and delivery can be measured via the aggregated delivery API — [Firebase message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority); [FCM understand delivery](https://firebase.google.com/docs/cloud-messaging/understand-delivery)
- Türkiye has been eligible for the official Cloud API since May 2024, while Syria remains ineligible (page updated Nov 2025) — [Meta WhatsApp Business Platform support](https://developers.facebook.com/documentation/business-messaging/whatsapp/support)

### Inferences
**MVP design**

1. **Channels and priority per event**
   - Booking confirmed, changed or cancelled: in-app inbox record → FCM (visible, high, collapse per appointment) → WhatsApp from the clinic session if the patient opted in → if the WhatsApp send fails or the session is down, a "send manually via wa.me" task on the receptionist dashboard.
   - Reminder (24 h; optional 2 h): the same ladder, spread over daytime hours, with quiet hours enforced.
   - Patients without the app: WhatsApp (if opted in) → manual wa.me task or phone call list.

2. **WhatsApp gateway**
   - WAHA (pinned 2026.x), GOWS engine (fallback engine: NOWEB), Postgres storage, API key, private network.
   - Container A runs the **platform verification number**. Containers B..N run clinic sessions, sharded about 20–50 per container. Validate density by load test.
   - Each clinic links its own **WhatsApp Business app** number by QR from a clinic-admin page. Onboarding includes a written risk acknowledgement and the rules: dedicated phone kept online, no more than 3 other linked devices, complete business profile.

3. **Messaging service (backend)**
   - Per-session FIFO queue (concurrency 1), random 20–60 s spacing, typing simulation, hourly cap (start ~30/h per clinic number), quiet hours 21:00–08:00, 3–5 template variants with personalization.
   - Store opt-in (`last_inbound_at`) and opt-out (`إيقاف`/STOP) per (clinic, patient). Send only to opted-in patients.
   - Webhooks: inbound (opt-in, opt-out, OTP), acks (delivered/read → UI ticks), session status → clinic alert.
   - Resolve `@lid` senders to phone numbers.
   - Circuit breaker: on 463/475 or warnings, pause the session's outbound for 24 h, route to the fallbacks, and alert the clinic admin. Never auto-re-pair.
   - Health job every 5 min, plus a "phone not seen ~10 days" reminder to the clinic.

4. **Phone verification (no SMS)**
   - **Primary: reverse WhatsApp OTP.** The app gets a nonce (TTL 10 min, device-bound) and opens `wa.me/<platform>?text=<code + "for my own device">`. The backend matches nonce and sender number, notifies the app over FCM or a websocket, and replies "verified" in the same chat.
   - **Secondary: Telegram Gateway** (`checkSendAbility` first; $0.01/code). Use it only after confirming +963 and +90 deliverability and that Fragment funding is feasible.
   - **Tertiary: reception-desk verification.** Staff open the patient's "claim" QR in the clinic dashboard, check identity and mark the phone verified. This is the best option for elderly patients.
   - Avoid outbound WhatsApp OTP to new numbers; it is the riskiest pattern for the platform number.
   - Optional: Google Sign-In for identity on devices where it works, still paired with a phone check.
   - Security: device binding of refresh tokens, re-verification on a new device, rate limits per device and per number, and staff-assisted recovery.

5. **Push (FCM)**
   - Own high-importance "مواعيد" (Appointments) channel, POST_NOTIFICATIONS requested after the first booking, permission state reported to the backend.
   - Per-OEM Arabic battery guide (Xiaomi, Samsung, Oppo/Realme, Tecno/Infinix, Huawei).
   - `analyticsLabel` on every send, plus a weekly review of aggregated delivery data.
   - Huawei Push Kit deferred until data shows non-GMS Huawei users matter.

6. **Exit ramp / continuity**
   - Keep the WhatsApp gateway behind an internal interface (`sendWhatsApp(clinicId, patientId, templateKey, vars)`), so that WAHA ↔ Baileys ↔ Evolution, or the **official Cloud API through a Turkish entity for +90 numbers**, can be swapped without touching business logic.
   - Re-evaluate Meta's Syria eligibility periodically, since US Syria sanctions were revoked in July 2025.

### Gaps
- Numeric throttling defaults (30/h, 20–60 s, 20–50 sessions per container) are engineering estimates and must be validated in a pilot with 2–3 clinics. Track bans and warnings per number for 4–6 weeks before scaling.
- The legal feasibility of a Turkish entity using the official Cloud API for a Syria-serving product was not researched. It needs legal advice.
