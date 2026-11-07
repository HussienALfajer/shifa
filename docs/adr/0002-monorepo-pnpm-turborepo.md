# ADR-0002: Monorepo with pnpm workspaces + Turborepo; TypeScript and Flutter in one repo

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Shifa has a TypeScript backend, several TypeScript web apps, a Flutter patient app, and shared artefacts that must never drift: the API contract, generated clients, design tokens and translations. The owner's fox-drop project ran TypeScript and Flutter in one repo with contract codegen and drift checks, which worked; its pain points were slow uncached checks and a heavy generated Dart client [RN-22 §4–5].

## Decision
- One Git repository with `apps/` (api, clinic-web, admin-web, display-web, booking-web, patient_app) and `packages/` (tokens, ui, contracts, api-client-ts, api_client_dart, db, domain-*, i18n, shifa_ui, testing).
- JavaScript/TypeScript: pnpm workspaces + Turborepo with caching on from day one (remote cache once CI exists).
- Dart/Flutter: pub workspaces in the same repo, Flutter version pinned with FVM; Melos only if pub workspaces prove insufficient.
- Generated packages are marked generated (`.gitattributes` linguist-generated) and protected from manual edits by a hook.
- One `verify` entry point (fast/affected and full) covers both toolchains (see [workflow](../process/development-workflow.md)).

## Consequences
+ Atomic changes across contract, server, web and app; drift checks are simple.
+ One place for Claude Code instructions, hooks and CI.
− Two toolchains in CI; Flutter steps must be filtered by affected paths to keep fast checks fast.
− Repo size grows with generated code; mitigated by named schemas and a lean Dart generator ([ADR-0013](0013-api-contract-openapi-zod.md)).

## Alternatives considered
- Nx: capable but more configuration than needed for <20 packages [RN-16 §16].
- Polyrepo (separate app repo): rejected — contract drift and cross-repo changes are exactly what hurt agent-built systems.

## Sources
[RN-16 §16], [RN-19 §B9, §B13], [RN-22 §4–7], [RN-20 §4]
