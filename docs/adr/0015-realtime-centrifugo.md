# ADR-0015: Realtime with Centrifugo fed from the outbox

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Queue boards, waiting-room displays, voice calls, the patient's live queue position and multi-device reception screens all need realtime updates across many tenants, on connections that drop often. Postgres LISTEN/NOTIFY takes a global lock at commit and does not scale as a fan-out bus [RN-16 §6].

## Decision
- Centrifugo OSS v6 (Apache 2.0) as the WebSocket/SSE fan-out server, with Valkey as its engine.
- Channels are namespaced per tenant and branch (and per display, per patient); access is granted by short-lived JWTs issued by the API.
- Events are published by the outbox relay after commit, so clients never see uncommitted state.
- Payloads are minimal change signals (entity, id, version, type); clients refetch details via REST ([ADR-0013](0013-api-contract-openapi-zod.md)). Exception: voice-call events carry the clip list and call id so displays can play immediately.
- History/recovery is enabled so a reconnecting display or receptionist receives missed events, then resynchronises state.
- Displays and the patient app fall back to polling when WebSockets are unavailable.

## Consequences
+ Offloads connection handling and reconnect recovery from the Node process.
+ Works for web, kiosk displays and Flutter with the same protocol.
− One more service to run and monitor.

## Alternatives considered
- Socket.IO in NestJS with a Valkey adapter: runner-up; more custom code for recovery.
- Server-Sent Events only: acceptable for displays, not for interactive multi-device sync.
- Postgres LISTEN/NOTIFY: commit-lock bottleneck.

## Sources
[RN-16 §6], [RN-15 §8], [RN-06 §3]
