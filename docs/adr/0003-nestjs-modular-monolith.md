# ADR-0003: Backend — NestJS 12 modular monolith with bounded contexts and a transactional outbox (pg-boss)

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
A small team (owner + Claude Code) must build a large domain: tenancy, scheduling and queue, EMR with specialty packs, billing in three currencies, imaging, messaging. Sources agree a modular monolith suits teams under ~15 engineers [RN-01], [RN-05]. TypeScript has the largest talent and AI-training pool and shares schemas with the web apps [RN-16 §1].

## Decision
- One deployable NestJS 12 application (Fastify adapter) structured as bounded-context modules: Identity & Access, Tenancy & Organisation, Entitlements/Flags/Settings, Scheduling & Queue, Patients (MPI), Clinical Records & Templates, Dental, Orthopedics, Imaging gateway, Billing & Cash, Notifications, Documents/Files, Reporting, Integrations/Webhooks, Audit.
- Each module exposes a public `index.ts`; cross-module imports of internals and cross-module table access are forbidden and enforced by lint rules and architecture tests.
- Cross-module side effects go through domain events written to an outbox table in the same transaction; pg-boss (Postgres-backed) runs jobs and relays events. Consumers are idempotent.
- Background workers run the same codebase as a separate process and set tenant context per job.

## Consequences
+ One deploy, one database transaction model, simple local development.
+ Module boundaries keep agent-written code from tangling; a module can be extracted later if ever needed.
− Discipline depends on enforced boundary tests, not convention.
− A single process means noisy jobs must be isolated in the worker process.

## Alternatives considered
- Microservices: operational cost far above team size.
- .NET 10 + ABP: strong, but ABP's tenancy/identity modules are commercial and it adds a second language next to the web stack [RN-16 §1].
- Laravel + stancl/tenancy v4: RLS mode experimental, weaker typing for AI-heavy work [RN-16 §1].
- Bare Fastify/Hono: less built-in structure for a large module graph.
- BullMQ/Redis queues: separate store, no atomic enqueue with business writes [RN-16 §5].

## Sources
[RN-16 §1, §5], [RN-05 §8], [RN-01], [RN-21 §5]
