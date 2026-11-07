# ADR-0016: Identity with Better Auth; phone verification by reverse WhatsApp code; no SMS

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Patients log in with a phone number; many have no email. The owner decided on 2026-11-07 that the product uses no SMS at all. The official WhatsApp Business Platform is not available for Syria [RN-10 §2]. Outbound OTP from an unofficial WhatsApp number to unknown contacts is the riskiest pattern for bans; a code sent by the user to the platform number is far safer [RN-10 §5]. Staff need strong authentication and multi-clinic membership ([ADR-0006](0006-one-organisation-model.md)).

## Decision
- Better Auth (1.5+) in-process with the Drizzle adapter: organization plugin (memberships, roles), phone-number plugin with a custom verification flow, 2FA (TOTP), passkeys, multi-session and admin plugins. Branch/room permissions live in our own tables.
- Patient phone verification, in order:
  1. Reverse WhatsApp code: the app requests a nonce (10-minute TTL, device-bound) and opens `wa.me/<platform number>?text=<code>`; the gateway webhook matches nonce and sender (resolving WhatsApp `@lid` IDs to phone numbers) and confirms over push/WebSocket.
  2. Reception verification: staff verify identity in person and confirm via the patient's claim QR — the preferred path for elderly patients.
  3. Optional later: Telegram Gateway, only after confirming delivery to +963/+90 and a payment route.
- No SMS anywhere.
- Staff: password + TOTP; TOTP mandatory for clinic owners and super admins; device sessions listed and revocable; re-verification on new devices for patients.
- Rate limits per device and per number; staff-assisted account recovery.

## Consequences
+ Works with the channels patients already use, without SMS costs or deliverability problems.
+ Low ban risk for the platform number because users initiate the chat.
− Depends on WhatsApp availability on the patient's phone; reception verification covers the rest.

## Alternatives considered
- Keycloak 26: heavier; WhatsApp OTP needs a custom SPI [RN-16 §7].
- Zitadel: AGPL since v3 [RN-16 §7].
- Auth0/Clerk/WorkOS: per-MAU USD billing and access risk from Syria.
- SMS or Firebase phone auth: rejected by the owner; Twilio blocks SMS to Syria since 2025-09-15 [RN-03 §3].
- Outbound WhatsApp OTP: highest ban risk; not used.

## Sources
[RN-10 §2, §5, §7], [RN-16 §7], [RN-05 §2], [RN-03 §3]
