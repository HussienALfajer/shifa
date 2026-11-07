# ADR-0010: Web apps — React 19 + Vite + TanStack Router SPA/PWA; Next.js 16 for public booking pages

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The clinic app must keep working through internet cuts (today's queue, walk-ins, cash receipts, printing) and runs on PCs, tablets and phones in Arabic RTL. Public booking pages need SEO and speed on weak mobile links, with subdomains now and custom domains later [RN-17 §1–§2].

## Decision
- clinic-web, admin-web and display-web: React 19 + TypeScript + Vite + TanStack Router as static SPAs with a service worker (vite-plugin-pwa/Workbox or Serwist) for the app shell; offline data lives in a local database per [ADR-0014](0014-offline-sync-engine.md), not in the HTTP cache.
- booking-web: Next.js 16 (App Router) self-hosted, tenant resolution in `proxy.ts` for subdomains; custom domains later through on-demand TLS (Caddy) [RN-05 §6].
- Shared libraries: TanStack Query (server state), Zustand (UI state), React Hook Form + Zod 4 (forms, shared schemas), TanStack Table + Virtual (dense tables), react-day-picker (dates, optional Hijri), i18next with ICU (Arabic plural forms; digit style per tenant, see OD-20).
- Components come from our design system ([ADR-0011](0011-design-system-base-ui.md)); clinical charts are in-house SVG components.
- Maps: MapLibre GL + OpenStreetMap with self-hosted tiles and Arabic labels.
- Fonts: IBM Plex Sans Arabic (UI) and Noto Naskh Arabic (print), self-hosted.

## Consequences
+ The clinic app runs with no server during outages; static hosting is simple.
+ One React/TypeScript skill set across all web surfaces.
− Two frameworks on the web (Vite SPA and Next.js), justified by different needs.

## Alternatives considered
- Next.js for the clinic app: server-dependent, monthly security releases, offline story harder [RN-17 §1].
- TanStack Start: stable only since 2026-10-13; too new for the core [RN-17 §1].
- React Router v8 SPA mode: credible runner-up.
- Vue/Nuxt, SvelteKit, Angular: not evaluated with current evidence; weaker fit with the chosen ecosystem [RN-17 §16].
- Astro for public pages: lighter JS but a third framework.
- Google Maps: Syria appeared on the prohibited-territories list (status unconfirmed) [RN-17 §9, §13].

## Sources
[RN-17 §1–§3, §5, §9, §13–§14, §16], [RN-05 §6]
