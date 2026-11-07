# Platform and service access for Syria

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: [RN-03 §3–§5], [RN-10 §2, §5–§6], [RN-15 §5], [RN-17 §9, §13], [RN-19 §B10], [RN-16 §14]

Purpose: a dated snapshot of sanctions status and of which global platforms Shifa can rely on, as researched on 2026-11-07/08. Status changes often; re-check before relying on any line. Owner decisions recorded on 2026-11-07/08 are marked "owner".

## Sanctions (legal layer)
| Date | Event |
|---|---|
| 2025-03/04 | UK delisted the central bank and other entities |
| 2025-05-23 | US OFAC General License 25 |
| 2025-05-28 | EU lifted economic sanctions |
| 2025-06-30 / 07-01 | US Executive Order 14312 ended the Syria sanctions programme |
| 2025-09 | US Commerce rule allowing most commercial software exports |
| 2025-12-18/19 | Caesar Act repealed (signed) |
| 2026-08-24 | Syria removed from the US State Sponsors of Terrorism list |
| Ongoing | Some export-control requirements (15 CFR 746.9) remain; companies still apply their own restrictions |

Sources: [RN-03 §3], [RN-17 §9] (community-sourced items not verified against the Federal Register).

## Platforms
| Service | Status (date) | Shifa approach |
|---|---|---|
| Google Play (users) | Reachable without VPN since 2026-01-18 [RN-03 §3] | Distribute the patient app on Play + direct APK fallback |
| Google Play Console (developers) | Syria excluded as developer account country (support confirmation 2026-09-21, community tracker) [RN-03 §3] | Owner already has a Play developer account (owner, 2026-11-07) |
| Firebase / FCM | Community reports restored Aug–Sep 2026; no official statement [RN-19 §B10]. Owner confirms it works in Syria and Azaz (owner, 2026-11-07) | Primary push channel with in-app fallback ([ADR-0017](../adr/0017-notifications-push-whatsapp.md)) |
| WhatsApp Business Platform (official Cloud API) | Syria ineligible for businesses and recipients (Meta page updated Nov 2025); 360dialog cannot register +963; Meta for Developers blocked from Syria as of 2026-11-04; minister met Meta 2026-10-11, no timeline [RN-10 §2] [RN-06 §5] | Not used; unofficial gateway (WAHA) as secondary channel |
| WhatsApp Business Platform for Türkiye | Eligible since May 2024 [RN-10 §7] | Possible official route for +90 numbers via a Türkiye entity — needs legal review (OD-12) |
| SMS | Twilio blocks all SMS to Syria since 2025-09-15; others require registered senders [RN-03 §3] | Not used (owner decision: no SMS) |
| Microsoft Azure | Access restricted inside Syria [RN-15 §5] | TTS voice packs generated on our servers outside Syria; clinics only download audio |
| AWS | Partially available; console blocked from Syria [RN-15 §5] | Not relied upon |
| Apple App Store | Returned September 2025; Syrian developer enrolment unconfirmed [RN-19 §B10] [RN-03 §3] | iOS app later, through the entity outside Syria |
| Google Maps Platform | Syria appeared on the prohibited-territories list (page version 2022; current status unconfirmed) [RN-17 §13] | MapLibre + OpenStreetMap |
| Stripe / PayPal | No evidence of launch [RN-03 §3] | No online card payments in Release 1 |
| Visa/Mastercard in Syria | International payments live 2026-08-26 at hotels, restaurants, government points [RN-03 §4] | Not relevant to Release 1 |
| Telecom | ~9.5M internet users (35.8%); Android ~95–96%; mobile ~25 Mbps vs fixed ~3 Mbps median; Azaz historically on Turkish networks; Zain taking over MTN Syria (commercial launch expected Q1 2027) [RN-03 §5] [RN-19 §B10] | Android-first, offline-tolerant, small payloads |

## Accounts and payment (OD-03)
All paid platform accounts (hosting, Azure, Figma, Expo/Shorebird if used, Apple Developer) are held and paid by an entity outside Syria (Türkiye is the natural choice for Azaz). Confirm which entity owns which account, and that each vendor's terms allow serving Syrian end users.
