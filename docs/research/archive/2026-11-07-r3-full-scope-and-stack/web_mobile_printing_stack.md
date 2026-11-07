# Frontend Web, Mobile, Charting and Printing Technologies for a Multi-Tenant Healthcare SaaS (Syria: Aleppo/Azaz) — November 2026

Research date: 2026-11-07. Scope: clinic web app (offline reception, RTL, printing, TV display), clinical charts (odontogram, perio, skeleton/body chart), DICOM viewer, public booking pages, patient mobile app, super-admin panel. No stack is assumed.

Method note for the report writer: research was web-only. The shared web-search budget ran out partway through, so some sub-questions (Vue/Nuxt/SvelteKit/Angular, MUI/Chakra/PrimeReact RTL details, RJSF/JSON Forms, i18n library comparison, Arabic font licences, Dexie/RxDB/SQLite-WASM details, Hiring market) could not be verified with 2026 sources. Where I add knowledge from before this session, it is placed under **Inferences** or **Gaps** and labelled "prior knowledge, not re-verified", never under Cited Findings.

---

## 1. Web framework for the clinic app (app-like SPA that must work offline)

### Takeaway
The current React meta-framework landscape (Nov 2026) is: Next.js 16.4 (server-centric, RSC, monthly security releases), React Router v8 (June 2026; SPA mode supported), and TanStack Start 1.0 (stable only since 13 Oct 2026). For an offline-first, app-like clinic UI whose critical path must run with no server, a client-rendered React SPA (Vite + TanStack Router, or React Router v8 in SPA mode) with a service worker is the lower-risk fit; Next.js App Router's strengths (RSC, Cache Components, proxy) are mostly server-side and add an attack/upgrade surface that an offline SPA does not need.

### Cited Findings
**Next.js**
- Next.js 16 shipped 2025-10-21 with Cache Components, stable Turbopack, file-system caching, React Compiler support and React 19.2 features; 16.1 on 2025-12-18; 16.2 on 2026-03-18 (stable Adapter API, adapter test suite, platform working group); 16.3 on 2026-08-03 ("Instant Navigations, a suite of tools for single-page-app responsiveness"); 16.4 on 2026-10-06 (lazy compilation, smaller Turbopack output, React 19.3 features) — [Next.js blog index](https://nextjs.org/blog)
- Next.js now runs a formal monthly security-release programme (announced 2026-07-13) plus out-of-band updates: critical upstream issue 2026-09-22 (16.3.6 / 15.5.26), two Critical + one High upstream vulnerabilities 2026-10-14, November security release 2026-11-03; earlier a critical RSC-protocol CVE-2025-66478 (2025-12-03) and two more RSC vulnerabilities (2025-12-11) — [Next.js blog index](https://nextjs.org/blog)
- Next.js 16.2 added AGENTS.md in create-next-app, browser log forwarding and next-browser for AI-agent debugging; 16.3 added "Skills" for coding agents — [Next.js blog index](https://nextjs.org/blog)
- Next.js 16 renamed the `middleware` file convention to `proxy` (codemod available); `proxy.ts` runs on the Node.js runtime and throws if a `runtime` option is set — [Vercel multi-tenant docs: proxy and routing](https://vercel.com/docs/platforms/multi-tenant-platforms/proxy-and-routing)
- PWA/offline in Next.js 16 relies on third-party Serwist (`@serwist/next`); Serwist's main Next.js guide "is meant for webpack" and Turbopack users are pointed to a separate guide; offline fallback is done by precaching `/~offline` via `additionalPrecacheEntries` and `fallbacks.entries` for `request.destination === "document"` — [Serwist docs: Next.js getting started](https://serwist.pages.dev/docs/next/getting-started)
- A Jan 2026 tutorial reports that Next.js 16 defaults to Turbopack while Serwist requires webpack, so builds use `next build --webpack` — [LogRocket: Next.js 16 PWA offline support](https://blog.logrocket.com/nextjs-16-pwa-offline-support/) (third-party; partly superseded by Serwist's separate Turbopack guide above)

**React Router**
- React Router v8 announced 2026-06-17 as the first release on a yearly major schedule; minimums Node 22.22.0+, React 19.2.7+, Vite 7+; ESM-only; middleware always on; `react-router-dom` dropped (use `react-router` and `react-router/dom`); React Router v6 and Remix v2 reached end of life; v7 keeps receiving security updates; minors up to v8.3.0 since — [Remix blog: React Router v8](https://remix.run/blog/react-router-v8); [InfoQ](https://infoq.com/news/2026/08/react-route-v8)
- SPA mode = `ssr: false` without `prerender`; produces one HTML file able to hydrate any path; `prerender` can be limited to specific paths and still emits a SPA fallback (`build/client/__spa-fallback.html` when `/` is prerendered); in SPA mode loaders are only allowed on the root route and `action`/`headers` are prohibited — [Remix guide: SPA mode](https://remix.run/guides/spa-mode); [React Router: pre-rendering](https://reactrouter.com/7.7.0/how-to/pre-rendering)

**TanStack Start / Router**
- TanStack Start 1.0 declared stable and "ready for production" on 2026-10-13; the team built an RSC integration but stopped using it on tanstack.com because it made "what ran where" hard to reason about; deployment partners listed: Cloudflare Workers, Vercel, Railway, Netlify, Render; Rsbuild supported — [TanStack blog: TanStack Start 1.0](https://tanstack.com/blog/tanstack-start-1-0)
- The v1.0 RC was announced 2025-09-23 — [TanStack: announcing Start v1](https://old.tanstack.com/blog/announcing-tanstack-start-v1)
- Secondary sources say Start 1.0 requires Vite 8 and renamed `.inputValidator()` to `.validator()` — [tech-insider](https://tech-insider.org/tanstack-start-1-0-stable-release-2026/); [Appwrite blog](https://appwrite.io/blog/post/tanstack-start-stable-appwrite-sites) (secondary, not verified against official migration guide)

**Ecosystem / popularity (proxy for AI-assistant proficiency and hiring)**
- State of JS 2025 (published early 2026): React most used front-end framework at 83.6%; Next.js most used meta-framework at 59%; Astro gaining as content-first alternative; Solid highest satisfaction for the fifth year; developers use 1.7 meta-frameworks on average — [InfoQ: State of JS 2025](https://www.infoq.com/news/2026/03/state-of-js-survey-2025). Sources disagree on respondent count (13,002 vs 25,000+) — [Strapi summary](https://strapi.io/blog/state-of-javascript-2025-key-takeaways)

### Inferences
- The clinic app's offline requirement (today's queue, walk-in registration, cash receipts) means the UI shell, routing and business logic must work with zero server round-trips. A pure client SPA served as static assets with a precaching service worker is the simplest way to guarantee that. Next.js can do it, but you fight its server-first defaults (RSC, proxy, Cache Components) and its Serwist/Turbopack integration is still a side path.
- Next.js' cadence of critical RSC/upstream security releases in 2025–2026 is an operational cost for a 3–5 person team; a static SPA has no server-rendering attack surface (the API server remains, of course).
- Vite + React + TanStack Router (file-based, type-safe search params—useful for dense filtered list screens) is the best fit; React Router v8 SPA mode is an equally viable runner-up with a longer track record and more AI training data. TanStack Start is attractive but only ~4 weeks into 1.0—too new to bet the clinic core on, though moving from TanStack Router to Start later is incremental.
- For the PWA layer with Vite, `vite-plugin-pwa` (Workbox) or `@serwist/vite` are the standard options (prior knowledge, not re-verified in this session).
- React's dominance (83.6% usage) makes React/TypeScript the stack where Claude Code and similar assistants have the most training signal; this matters for a small AI-assisted team.

### Gaps
- Vue/Nuxt 4, SvelteKit 2/Svelte 5 and Angular 20+ could not be evaluated with 2026 sources (search budget exhausted). Prior knowledge (not re-verified): all three have workable PWA stories (Vite PWA plugin for Nuxt/SvelteKit, `@angular/service-worker`), but their RTL-capable, dense-data component ecosystems (data grids, Hijri pickers) are thinner than React's, and Angular's bundle/learning curve is heavier.
- No current, measured bundle-size comparison between frameworks was found.

---

## 2. Public booking pages (SEO, fast on 3G, subdomains now, custom domains later)

### Takeaway
Next.js 16 has the most documented multi-tenant path (proxy.ts tenant resolution for subdomains and custom domains, official `vercel/platforms` reference app) and, since 16.2, a stable Adapter API that improves self-hosting outside Vercel. Astro is the lighter-JS alternative for mostly-static pages.

### Cited Findings
- Vercel's multi-tenant docs show `proxy.ts` resolving tenants from subdomains, then looking up custom domains in a database or Edge Config; tenant identity is passed as a request header (e.g. `x-tenant-id`) that must only be set by the proxy, never trusted from the client — [Vercel: multi-tenant concepts](https://vercel.com/docs/platforms/multi-tenant-platforms/concepts); [Vercel: proxy and routing](https://vercel.com/docs/platforms/multi-tenant-platforms/proxy-and-routing)
- On Vercel, wildcard domains require Vercel nameservers and each custom domain gets its own certificate; `vercel/platforms` is a Next.js 16 multi-tenant example using Upstash Redis and a proxy for subdomain routing — [vercel/platforms (fork)](https://github.com/mrwebwork/platforms); [Vercel template](https://vercel.com/new/users-projects/templates/next.js/platforms-starter-kit)
- Next.js 16.2 introduced a stable Adapter API, a public adapter test suite and a working group (with OpenNext) for consistent deployment across platforms — [Next.js blog: Next.js across platforms](https://nextjs.org/blog)
- Astro continued to gain ground as a content-first meta-framework in State of JS 2025 — [InfoQ](https://www.infoq.com/news/2026/03/state-of-js-survey-2025)
- React Router supports pre-rendering specific paths at build time — [React Router: pre-rendering](https://reactrouter.com/7.7.0/how-to/pre-rendering)
- Expo SDK 58 (2026-10-15) made Expo Router data loaders, SSR and middleware stable, and web projects now default to server output — [Expo SDK 58 changelog](https://expo.dev/changelog/sdk-58) (relevant only if the team chose Expo and wanted one codebase for app + web pages; not recommended for SEO pages here)

### Inferences
- Booking pages are read-mostly per tenant (clinic profile, doctors, services, hours, slot picker). Next.js with ISR/`use cache` per tenant + a small client island for the slot picker gives good 3G performance and SEO, and shares React components/Tailwind tokens with the clinic SPA.
- Self-hosting in the region (likely needed for latency/cost and because Vercel's wildcard setup assumes Vercel DNS): run Next.js in Node behind a reverse proxy that does on-demand TLS for custom domains (Caddy on-demand TLS or Traefik + ACME are the usual patterns — prior knowledge, not re-verified).
- Astro is a strong runner-up: near-zero JS by default (better on 3G), React islands for the booking widget, but a second framework for the team to maintain.
- Keep booking pages Arabic-first with `<html dir="rtl" lang="ar">`, `hreflang` if an English variant exists, and LocalBusiness/MedicalClinic schema.org markup.

### Gaps
- No 2026 measured Core Web Vitals comparison between Next.js and Astro on 3G was found.
- Custom-domain TLS automation for self-hosted Next.js was not verified with a 2026 source.

---

## 3. UI component libraries with first-class RTL, data tables, date pickers, Arabic fonts, Tailwind v4

### Takeaway
shadcn/ui gained official RTL support in January 2026 (CLI converts physical to logical Tailwind classes), sits on Radix (now a single `radix-ui` package) or Base UI (stable 1.0 since Dec 2025), and pairs naturally with Tailwind v4.3 logical utilities. Mantine (DirectionProvider) and Ant Design 6 (logical start/end APIs, RTL) are mature batteries-included alternatives; Ant Design is especially strong for dense admin/data screens.

### Cited Findings
**shadcn/ui, Radix, Base UI**
- shadcn/ui RTL (January 2026): set `rtl: true` in `components.json` and the CLI rewrites classes at install time (`ml-*`→`ms-*`, `left-*`→`start-*`, `text-left`→`text-start`); `--rtl` flag on `init`/`create`; `migrate rtl` converts an existing `ui` directory; directional icons flip with `rtl:rotate-180`; slide-in animations switch to start-based; RTL examples exist for every component — [shadcn/ui changelog: RTL](https://ui.shadcn.com/docs/changelog/2026-01-rtl)
- A February 2026 update moved shadcn components from individual `@radix-ui/react-*` packages to the single `radix-ui` package and added inline-start/inline-end animation classes — [GitHub PR description, objectui](https://github.com/objectstack-ai/objectui/pull/1059) (secondary)
- Third-party shadcn ecosystem libraries are following: Dice UI's Oct 2026 changelog says its components now install in the user's shadcn style and support RTL — [Dice UI changelog](https://diceui.com/docs/changelog/2026-10-styles); ReUI documents RTL — [ReUI RTL](https://reui.io/docs/rtl)
- Base UI 1.0 released 2025-12-11 after ~2 years, 35 accessible unstyled components, package renamed `@base-ui/react`, maintained by MUI with contributors from Radix and Floating UI; release tracker shows v1.6.0 latest — [InfoQ: Base UI v1](https://www.infoq.com/news/2026/02/baseui-v1-accessible); [Base UI v1.0.0 release notes (unpkg)](https://app.unpkg.com/@base-ui/react@1.6.0/files/docs/react/overview/releases/v1-0-0.md)

**Mantine, Ant Design**
- Mantine: wrap the app in `DirectionProvider` (required for RTL or dynamic direction switching); `detectDirection` reads the root `dir` attribute; `useDirection` hook; `rtl` / `not-rtl` CSS mixins via `postcss-preset-mantine` — [Mantine: right-to-left direction](https://mantine.dev/styles/rtl/)
- Ant Design 6.0 released at SEE Conf 2025 with Ant Design X 2.0; minimum React 18; APIs use logical position descriptions (start/end) and support RTL; v5 enters one-year maintenance (no functional updates) — [Ant Design 6.0 release post (dev.to, antd maintainer)](https://dev.to/zombiej/ant-design-60-is-released-bfa); [besthub summary](https://www.besthub.dev/articles/what-s-new-in-ant-design-6-0-a-deep-dive-into-the-latest-frontend-upgrade-f01d14b85286)

**Tailwind CSS v4**
- Tailwind docs (v4.3) list logical margin utilities `ms-*` (margin-inline-start), `me-*`, `mbs-*`, `mbe-*` (block start/end), plus `mx-*`→`margin-inline`, `my-*`→`margin-block`, responding to `dir="rtl"` on ancestors — [Tailwind CSS docs: margin](https://tailwindcss.com/docs/margin)

**Data tables**
- AG Grid Community is MIT-licensed "including for production use"; Row Grouping, Pivoting, Excel Export and Set Filter are Enterprise-only; server-side row grouping/pivot/tree data/master-detail are Enterprise; Enterprise price is configurator-based (1–10 developers online; customer-facing apps require sales contact) — [AG Grid licence & pricing](https://www.ag-grid.com/license-pricing/)

**Date pickers (Arabic + Hijri)**
- React DayPicker has a dedicated Hijri (Umm al-Qura) build: Arabic labels, RTL and Arabic-Indic digits by default, switchable to `numerals="latn"`; supported Gregorian range 1924-08-01 to 2077-11-16 (dates outside are clamped) — [DayPicker: Hijri calendar](https://daypicker.dev/localization/hijri)
- Alternatives: `@fk6/react-datepicker` (Hijri via moment-hijri, `calendar="hijri"`), `@mk01/react-hijri-date-picker` (low adoption) — [yarn: @fk6/react-datepicker](https://classic.yarnpkg.com/en/package/@fk6/react-datepicker); [pkgstats](https://www.pkgstats.com/pkg:@mk01/react-hijri-date-picker)

### Inferences
- **Recommendation: shadcn/ui (Radix or Base UI primitives) + Tailwind v4 logical utilities**, with TanStack Table (headless, MIT — prior knowledge) for dense tables and TanStack Virtual for long lists. Reasons: code is copied into the repo (no upstream breaking-change lock-in, easy for AI assistants to read/modify), RTL is now first-class via the CLI, and the same tokens serve the booking pages. shadcn's DatePicker is built on react-day-picker, so the DayPicker Hijri build slots in directly.
- **Runner-up: Ant Design 6** — richest out-of-the-box dense-data components (Table with fixed columns/summary rows, Form, Tree, Transfer), long-standing RTL via ConfigProvider, popular in Arab/Chinese markets; cost is a heavier bundle and a more opinionated look. Mantine 8 is a close third with excellent RTL and DX.
- AG Grid Community is worth it only if the team needs spreadsheet-like editing at scale; most clinic screens (queue, patient lists, invoices) fit TanStack Table. Avoid designs that depend on Enterprise-only grouping/Excel export unless the licence is budgeted.
- Hijri should be an optional secondary display (Syria uses the Gregorian calendar officially; Hijri mainly for religious dates) — inference, not sourced.
- Arabic UI fonts (prior knowledge, not re-verified): IBM Plex Sans Arabic, Cairo, Tajawal, Noto Kufi Arabic and Noto Naskh Arabic are all on Google Fonts under the SIL Open Font License; for dense UIs IBM Plex Sans Arabic or Noto Kufi Arabic have good small-size legibility and many weights; self-host subsetted WOFF2 (Arabic + Latin + digits) for offline and 3G. Test that the font's digits match the chosen numbering system.

### Gaps
- MUI v7 RTL (stylis-plugin-rtl + `theme.direction`, prior knowledge), Chakra UI v3 RTL and PrimeReact RTL could not be re-verified with 2026 sources.
- No source confirmed whether Ant Design 6 `ConfigProvider direction="rtl"` is unchanged from v4/v5 (likely, but unverified).
- AG Grid RTL support is not stated on the licence page (AG Grid has an `enableRtl` option per prior knowledge).
- Arabic font licences/metrics were not verified this session.

---

## 4. Forms and validation for dynamic clinical templates (JSON-schema driven)

### Takeaway
React Hook Form remains the default (far larger adoption, smaller bundle); TanStack Form v1 has stronger type inference for nested/dynamic forms. For JSON-schema-driven clinical templates, a thin custom renderer over RHF or TanStack Form plus Zod 4 schemas is usually more controllable than generic renderers, but RJSF/JSON Forms could not be evaluated with 2026 sources.

### Cited Findings
- Mid-2026 versions: React Hook Form 7.77.0, TanStack Form 1.33.0; no v8 of either confirmed — [Formisch comparison](https://formisch.dev/blog/react-form-library-comparison/); [PkgPulse](https://www.pkgpulse.com/guides/best-react-form-libraries-2026)
- React Hook Form ~12.1 kB gzipped (uncontrolled, ref-based) vs TanStack Form ~17.3 kB (headless, controlled); ~213M vs ~8M monthly downloads — [DevCompare](https://devcompare.5-101-118-104.sslip.io/compare/react-hook-form-vs-tanstack-react-form) (secondary aggregator)
- RHF "remains the default choice for most React applications in 2026"; TanStack Form has "the strongest inference for nested and dynamic forms" but needs more setup — [PkgPulse](https://www.pkgpulse.com/guides/best-react-form-libraries-2026); [LogRocket](https://blog.logrocket.com/tanstack-form-vs-react-hook-form/)

### Inferences
- Clinical templates (dental exam, ortho exam, consent, prescriptions) are best stored as versioned JSON (schema + UI layout + scoring rules) and rendered by an in-house component map (field type → shadcn component). That keeps RTL, Arabic labels, clinical widgets (tooth selector, pain scale, body-region picker) and print layouts under the team's control.
- RHF with `useFieldArray` and a Zod resolver is the safest choice for AI-assisted development (most examples in training data). Choose TanStack Form if strict end-to-end typing of complex nested forms is valued over ecosystem size.
- Zod 4 (prior knowledge, not re-verified: stable since mid-2025, includes native JSON Schema conversion) can be the single source of truth for API DTOs, form validation and template schemas when the backend is TypeScript.

### Gaps
- RJSF, JSON Forms (EclipseSource) and uniforms: 2026 versions, RTL behaviour and maintenance were not researched (budget exhausted). Prior knowledge: RJSF has a shadcn theme in its community ecosystem and JSON Forms has React renderers; both can be heavy to customise for bespoke clinical widgets.
- Zod 4 current minor version and JSON-schema interop details not verified.

---

## 5. Data fetching, state and offline local database (browser and mobile)

### Takeaway
PowerSync is the most complete Postgres↔SQLite sync engine covering web (OPFS-backed SQLite WASM), Flutter, React Native and Kotlin with one sync-rules model, and has a free self-hosted Open Edition. For the narrow offline scope (today's queue, walk-ins, cash receipts) a simpler Dexie (IndexedDB) + outbox/idempotency design is a realistic runner-up.

### Cited Findings
- PowerSync web SDK: new databases default to OPFS on Chrome and Firefox (May 2026 changelog) — [PowerSync changelog May 2026](https://powersync.com/blog/powersync-changelog-may-2026)
- PowerSync web SDK v2.0.0 (2026-07-21) was breaking (sync options moved to `connect()`); v2.4.0 (2026-09-21) fixed race conditions in the OPFS write-ahead VFS by pinning wa-sqlite 2.0.5; v2.5.0 dated 2026-10-19 — [PowerSync releases](https://releases.powersync.com/announcements/ann_eTOfAnk3Otfhc); [powersync-js web README](https://github.com/powersync-ja/powersync-js/blob/main/packages/web/README.md)
- wa-sqlite's OPFSWriteAheadVFS allows multiple workers to read concurrently with a writer — [PowerSync/wa-sqlite announcement via LinkedIn](https://linkedin.com/showcase/journeyapps-powersync) (secondary)
- PowerSync pricing: Free $0 (2 GB synced/month, 500 MB hosted, 50 peak concurrent clients, deactivates after 1 week inactivity); Pro from $49/month (30 GB synced, 1,000 concurrent clients, then $30 per 1,000); Team from $599/month (SLA); Enterprise custom; **Open Edition self-hosted free**; client SDKs for JavaScript Web, Dart/Flutter, React Native, Kotlin on all plans — [PowerSync pricing](https://www.powersync.com/pricing)
- Expo SDK 58: `expo-sqlite` added `interruptSync()` and `configureWeb()` (custom wa-sqlite build for web FTS); libSQL support removed — [Expo SDK 58 changelog](https://expo.dev/changelog/sdk-58)

### Inferences
- **Recommended pattern**: TanStack Query for server state + a local SQLite/IndexedDB store as the offline source of truth for the offline subset; Zustand (or Jotai) only for UI state. Every offline mutation (walk-in, receipt) gets a client-generated UUID/ULID and an idempotency key; receipt numbers issued offline use a per-device prefix/sequence to avoid collisions; server reconciles with "last-writer-wins + audit log" except for money, which should be append-only.
- **PowerSync** (self-hosted Open Edition near the backend) if the team wants one sync model for clinic web + patient app, with tenant scoping in sync rules. Watch: the web SDK had a breaking 2.0 in July 2026 and OPFS-VFS race fixes in Sept 2026—pin versions and test on the actual reception PCs/tablets (Chromium-based browsers).
- **Runner-up: Dexie.js + custom outbox** — smaller, no extra server component, adequate for a bounded offline scope (prior knowledge: Dexie is Apache-2.0; Dexie Cloud is a separate paid service; RxDB's premium storage plugins are commercial — not re-verified).
- Medical data at rest in the browser: IndexedDB/OPFS is not encrypted by default; limit offline data to today's queue and minimal demographics, clear on logout, and consider app-level encryption for sensitive fields (inference).

### Gaps
- PowerSync Open Edition licence (I believe FSL/source-available, not OSI) not confirmed on the pricing page.
- Dexie 4.x, RxDB 16.x, ElectricSQL and official SQLite WASM (OPFS) were not re-verified in 2026 sources.
- Safari/iPadOS OPFS durability and eviction behaviour for clinic tablets not verified.

---

## 6. Interactive clinical charts: odontogram, perio, ortho, skeleton/body pain map

### Takeaway
Element counts for these charts are small (hundreds to ~2,000 interactive shapes), which is SVG's sweet spot: DOM-level hit testing, CSS theming, ARIA labelling, crisp printing and direct vector export to PDF. Canvas (Konva) is better for thousands of shapes or freehand drawing but has no accessible DOM. Existing open-source odontogram components are thin (no surfaces/perio) and best treated as references; anatomy art can come from CC BY 4.0 sources such as Servier Medical Art.

### Cited Findings
- Konva's own guidance: SVG keeps each shape as a DOM element and suits diagrams with few shapes; Canvas does not retain shapes and suits many shapes/frequent redraws; Konva adds a retained scene graph with built-in hit detection (colour-map hashing) but does not create accessible DOM elements, so essential controls must stay in HTML — [Konva: Canvas vs SVG](https://konvajs.org/docs/posts/canvas-vs-svg.html); [Konva: best canvas library 2026](https://konvajs.org/docs/guides/best-canvas-library.html)
- Konva's published engine benchmark pins Konva 8.1.4 and PixiJS 6.1.3 (Sept 2021), so numbers are outdated — [Konva guide](https://konvajs.org/docs/guides/best-canvas-library.html)
- A react-konva case with ~20k rectangles was reported as very laggy — [Stack Overflow archive](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/65847419/rendering-lots-of-canvas-elements-with-react-konva)
- `react-odontogram` (biomathcode): MIT, "Built with SVG and React hooks", FDI default plus Universal/Palmer, `teethConditions` colouring, `maxTeeth` for primary/mixed dentition, React Native variant via react-native-svg; 82 stars, no published releases, surfaces and perio not mentioned — [GitHub: biomathcode/react-odontogram](https://github.com/biomathcode/react-odontogram)
- `op-odontogram`: React FDI chart with 32 permanent + 20 temporary teeth — [DeepWiki: op-odontogram](https://deepwiki.com/pedroinformatico/op-odontorgram) (secondary; licence not verified); `react-odontogram-3d` exists as a 3D variant — [pkgstats](https://www.pkgstats.com/pkg:react-odontogram-3d)
- Servier Medical Art images are CC BY 4.0, free including commercial use with attribution; library has a Locomotor system → Bones category; teeth category not confirmed — [Servier Medical Art](https://smart.servier.com/)

### Inferences
- **Recommendation: custom SVG components in React** for odontogram (FDI 11–48 and 51–85, 5 surfaces per tooth as separate `<path>`s, status layers: caries, filling, crown, RCT, implant, missing, extraction-planned, bridge pontic/abutment), perio chart (6 sites × 32 teeth: PD, CAL/REC, BOP, suppuration, plaque, mobility, furcation; line graphs as SVG polylines) and ortho (Angle class, overjet/overbite fields, bracket/wire states).
  - State model is data-first (JSON per tooth/surface with history and author), rendering is a pure function of state → trivial printing, PDF export (render the same SVG server-side or via `svg2pdf`/print CSS), undo/redo, and audit.
  - Accessibility: each tooth `<g role="button" aria-label="Tooth 36, occlusal: composite filling">`, keyboard navigation in FDI order; tablets: enlarge hit areas with transparent strokes, use Pointer Events.
- **Skeleton/body chart**: layered SVG (front/back views; regions and joints as named paths with laterality L/R attributes), pain intensity as fills/heatmap, plus an optional Canvas overlay (Konva or plain `<canvas>` with Pointer Events) for freehand pain drawing that is stored as normalised vectors. Assets: commission or adapt CC BY 4.0 anatomy (Servier) or draw in Figma; avoid unclear-licence stock SVGs.
- **Runner-up: react-konva** for the skeleton/pain-drawing surface if freehand annotation and pinch-zoom become central.
- The same SVG components (via react-native-svg) can be reused in a React Native patient app for read-only views; this is a concrete code-sharing argument for RN over Flutter (inference).

### Gaps
- No 2026 tablet benchmark of SVG vs Canvas for this element count was found.
- No professionally complete open-source odontogram with surfaces + perio under a permissive licence was found; commercial dental-chart SDKs were not researched.
- Licences of op-odontogram and react-odontogram-3d not verified; Servier dental illustrations not confirmed.

---

## 7. DICOM viewer embedding (OHIF / Cornerstone3D)

### Takeaway
OHIF v3 is a full PWA viewer whose documented embedding path is an iframe (script-tag embedding is deprecated), configured by `PUBLIC_URL` and `routerBasename`, with postMessage for communication. Embedding OHIF as a separate app under a sub-path is the pragmatic v1 choice; building directly on Cornerstone3D is only worth it for lightweight inline previews.

### Cited Findings
- OHIF v3.11 (Aug 2025): fusion overlay, RT Dose/RT Structure Set, ultrasound mode, DICOM Labelmap segmentation, SCOORD3D import/export — [OHIF v3.11 release notes](https://ohif.org/release-notes/3p11/)
- OHIF v3.12 (Feb 2026): freehand segmentation tool with nudge editing, tabbed segmentation panel, formal governance framework — [OHIF v3.12 release notes](https://ohif.org/release-notes/3p12)
- OHIF docs labelled "3.14 Beta (Latest)", last updated 2026-11-03; script-tag usage of OHIF v3 is deprecated; iframe embedding uses `PUBLIC_URL=/ohif/` and matching `routerBasename`; postMessage is available for communication — [OHIF docs: iframe](https://docs.ohif.org/deployment/iframe)
- OHIF describes itself as a configurable, extensible PWA supporting DICOMweb — [GitHub: OHIF/Viewers](https://github.com/OHIF/Viewers)
- `@cornerstonejs/core` is at 4.6.x — [yarn: @cornerstonejs/core](https://classic.yarnpkg.com/en/package/@cornerstonejs/core)

### Inferences
- Serve OHIF from the same origin under `/viewer/` (avoids third-party cookie/CORS issues for DICOMweb auth), open it in an iframe or new tab with a short-lived token scoped to the study; backend PACS via DICOMweb (e.g. Orthanc — not researched here).
- Keep the viewer UI LTR inside the RTL app: imaging UIs (orientation markers, measurements, tool layouts) are conventionally LTR, and OHIF's docs show no RTL/Arabic support (inference). Translate labels via OHIF's i18n if needed.
- Low-end clinic PCs: 3D/MPR via WebGL can be heavy; for dental/ortho X-rays (2D), a stack viewport is enough.

### Gaps
- No source on OHIF RTL/Arabic support, nor on COOP/COEP (cross-origin isolation for SharedArrayBuffer-based decoders) requirements in 3.12–3.14.
- Cornerstone3D pinned version per OHIF release not verified.

---

## 8. Patient mobile app: Flutter vs React Native (New Architecture) + Expo vs Kotlin/Compose Multiplatform

### Takeaway
Both Flutter (3.44 stable May 2026; 3.47/3.50 scheduled) and React Native via Expo (SDK 58, RN 0.88, New Architecture only since SDK 55) are mature. The deciding factors for this team are TypeScript code-sharing with the web/backend, reuse of SVG chart components, AI-assistant proficiency in TS, and OTA cost (EAS Update and Shorebird are both cheap at this scale). Flutter's advantages are self-drawn RTL with no restart quirk and consistent rendering on low-end Android; RN's I18nManager requires an app restart to flip direction.

### Cited Findings
**React Native / Expo**
- Expo SDK 55 released 2026-02-25 with React Native 0.83; Legacy Architecture can no longer be used from SDK 55; Hermes v1 opt-in (planned default in SDK 56) with bytecode diffing for smaller updates; SDK packages now share the SDK major version — [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55)
- SDK 55 notes were later updated to warn that apps opting into Hermes v1 may hit memory and dev-startup regressions (pointing to SDK 57 notes) — [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55)
- Expo SDK 56 released 2026-05-21; SDK 57 2026-06-30; SDK 58 2026-10-15 — [Expo changelog](https://expo.dev/changelog)
- SDK 58 upgrades React Native to 0.88; Expo Router loaders/SSR/middleware stable; on iOS, `expo-localization` no longer force-enables RTL from the device locale and layout direction now follows `I18nManager`; `expo-updates` adds `updates.maxUpdatesToKeep` — [Expo SDK 58 changelog](https://expo.dev/changelog/sdk-58)
- React Native `I18nManager`: `forceRTL`/`allowRTL` take effect only after a full app restart; the setting persists across restarts; Android requires `android:supportsRtl="true"`; forcing RTL is described as a dev/testing tool — [React Native docs: I18nManager](https://reactnative.dev/docs/i18nmanager)
- EAS pricing: Free $0 (1,000 Update MAUs, up to 15 Android + 15 iOS builds); Starter $19/month + usage (3,000 MAUs, $45 build credit); Production $199/month + usage (50,000 MAUs, $225 build credit); overage $0.005/MAU for 3,001/50,001–200,000 then tiered down to $0.00085; Enterprise custom from $1,000 — [Expo pricing](https://expo.dev/pricing)
- An EAS Update MAU is a unique user who downloads at least one update in the billing period — [Expo billing FAQ](https://docs.expo.dev/billing/faq/)

**Flutter**
- Flutter 3.41 (Feb 2026) — [Flutter blog: What's new in 3.41](https://flutter.dev/blog/whats-new-in-flutter-3-41)
- Flutter 3.44 stable 2026-05-18 with Dart 3.12; Swift Package Manager default for iOS/macOS; start of decoupling Material/Cupertino from the core SDK — [CMARIX](https://www.cmarix.com/blog/latest-flutter-version/); [issoh.co.jp](https://www.issoh.co.jp/tech/details/15767/) (secondary)
- Flutter archive lists 3.47 for August 2026 and 3.50 for November 2026 (branch cut 2026-10-06) — [Flutter SDK archive](https://docs.flutter.dev/install/archive) (release status of 3.47/3.50 not confirmed)
- Shorebird (Flutter code push) pricing: Hobby $0 (5,000 patch installs/month); Pro $20/month or $240/year (50,000); Business $400/month or $4,800/year (1,000,000); overage $1 per 2,500 installs; Enterprise custom with invoice billing — [Shorebird pricing](https://shorebird.dev/pricing)
- Dart package `thermal_unicode_print` rasterises Arabic and other scripts with dart:ui for thermal printers — [pub.dev: thermal_unicode_print](https://pub.dev/packages/thermal_unicode_print/license)

**Performance**
- Shorebird's 2026 comparison says the Flutter/RN performance gap "has narrowed significantly" — [Shorebird: Flutter vs React Native 2026](https://shorebird.dev/blog/flutter-vs-react-native) (vendor with Flutter interest)
- Third-party figures (low rigour): launch ~1.1 s Flutter vs ~1.2 s RN (Hermes); stress-test FPS 59–60 vs 54–58; Flutter bundles its engine (~5–10 MB overhead) — [dev.to benchmark analysis](https://dev.to/novaandersen/flutter-vs-react-native-performance-a-real-app-benchmark-analysis-57l1); [Empat](https://www.empat.tech/blog/react-native-vs-flutter)
- Open benchmark (zero-one-group): with RN New Architecture, RN has slight advantages in iOS IPA size and cold start but lags Flutter in resource-intensive scenarios — [GitHub: flutter-react-native-benchmark](https://github.com/zero-one-group/flutter-react-native-benchmark)

**Kotlin / Compose Multiplatform**
- Compose Multiplatform 1.8.0 made Compose for iOS stable (May 2025); 1.11.0 released 2026-05-15; web (Kotlin/Wasm) still beta; 1.13.0-beta01 stabilises more iOS interop — [JetBrains blog](https://blog.jetbrains.com/kotlin/2025/05/compose-multiplatform-1-8-0-released-compose-multiplatform-for-ios-is-stable-and-production-ready/); [Kotlin docs: what's new 1.13](https://kotlinlang.org/docs/multiplatform/whats-new-compose-113.html); [issoh.co.jp](https://www.issoh.co.jp/tech/details/16032/)

### Inferences
- **Recommendation: React Native + Expo (SDK 58, New Architecture, Hermes)**, Android-first:
  - One language (TypeScript) across web, mobile and a TS backend: shared Zod schemas, API client (OpenAPI → TS), i18n catalogs, date/number formatting, business rules (queue ETA, booking validation).
  - react-native-svg reuse of odontogram/body-chart rendering logic for patient-facing read-only views.
  - AI assistants are generally strongest in TS/React (inference from React's 83.6% usage share; no Dart-specific proficiency data found).
  - RTL caveat is manageable: the patient app is Arabic-first, so set `supportsRTL`/`forcesRTL` at build time (or `I18nManager.forceRTL(true)` on first launch) rather than switching at runtime; if an English toggle is added, accept one restart (Expo `Updates.reloadAsync()`).
  - Low-end Android: use Hermes, FlashList-style virtualised lists, avoid heavy JS animation, enable R8/ABI splits; test on a 2–3 GB RAM Android Go-class device.
- **Runner-up: Flutter** — strongest choice if the team were Dart-comfortable: self-rendered RTL via `Directionality` (no restart), smooth scrolling on low-end devices, excellent offline story (Drift, PowerSync Flutter SDK), Shorebird OTA at $20/month. Costs: a second language, OpenAPI→Dart codegen, no reuse of React components, larger base APK.
- Compose Multiplatform is credible on Android (native Compose) but adds Kotlin as a third language and has a smaller hiring/AI-example pool for a TS-centric team; not recommended here.
- OTA cost at expected scale (tens of thousands of MAU) is modest for both: EAS Production $199/month covers 50k MAU; Shorebird Pro $20/month covers 50k patch installs.
- Offline DB in RN: expo-sqlite or op-sqlite, or PowerSync RN SDK (same sync rules as web); WatermelonDB is older (prior knowledge, not re-verified).

### Gaps
- The Software Mansion "same app in Flutter and RN" study URL returned 404; its measured numbers could not be cited.
- No 2026 APK-size measurements for a minimal Expo SDK 58 vs Flutter 3.44 app were found.
- Whether Expo/Shorebird accept payment from a Turkish company card (Stripe-based billing is likely) was not confirmed; neither pricing page lists payment methods.
- Hiring availability of Flutter vs RN developers in Syria/Turkey: no reliable data found.
- AI-assistant proficiency Dart vs TS: no measured source found.
- FCM: neither stack was verified against Syria-specific Firebase availability (see section 9).

---

## 9. Syria-specific platform availability (Google Play, Firebase/FCM, Google Maps)

### Takeaway
Google services started returning to Syria in January 2026 (Play Store for users), but each service needs separate approval; community sources report the Play Console still excludes Syria as a developer account country (Sept 2026). Publish apps and hold Google/Firebase/Apple accounts through the Turkish company, and design so that FCM is not the only real-time channel.

### Cited Findings
- On 2026-01-18 Syria's communications minister said many users could access Google Play without VPNs, with most Google platforms expected nationwide "within weeks"; each service "requires legal and procedural approvals" and a phased launch — [Anadolu Agency](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- Community-maintained tracker: in September 2026 Google Play Developer Support confirmed Syria is still excluded as a Play account country (so paid content cannot be purchased) — [Unblock Syria: Google Play Console](https://unblocksyria.com/en/services/google-play-console) (community source)
- US ended the Syria sanctions programme on 2025-07-01 (EO 14312) and removed Syria from the State Sponsors of Terrorism list on 2026-08-24, while some export-control requirements (15 CFR 746.9) still apply — [GitHub PR: app-store-compliance](https://github.com/mjmirza/app-store-compliance/pull/967) (community source; not verified against official Federal Register text)
- Firebase is listed by community sources among services that restored access for Syrian users; no official Google confirmation found — [GitHub issue](https://github.com/kushagrasinghx/BitChord/issues/507); [Unblock Syria](https://unblocksyria.com/en/services/pub-dev)
- Syria appeared on Google Maps Platform's prohibited-territories list (snippet from a page version dated March 2022; current version not readable) — [Google Maps Platform prohibited territories](https://cloud.google.com/maps-platform/terms/maps-prohibited-territories)

### Inferences
- Register Google Play Console, Firebase project and (later) Apple Developer under the Turkish legal entity; the app is free, so the Play "account country" restriction on paid content is not blocking for users.
- FCM delivery on Syrian networks should be tested early; keep an in-app polling/WebSocket fallback for live queue tracking and WhatsApp as the out-of-band channel for critical notifications.
- Avoid Google Maps Platform for anything served to Syrian users until the prohibited-territory status is confirmed (see section 13).

### Gaps
- No official Google statement on Play Console / Firebase / Maps Platform availability for Syrian developers or end-users in 2026.
- Real-world FCM delivery reliability in Aleppo/Azaz (Syrian vs Turkish mobile operators) not found.

---

## 10. PWA viability as the patient app (vs native)

### Takeaway
A PWA is viable as a fallback/companion (booking, queue tracking via link) but weaker than a native Android app for this audience: iOS web push needs iOS 16.4+ and Home-Screen installation, and install rates for PWAs could not be sourced. Android web push works in Chrome.

### Cited Findings
- iOS/iPadOS web push requires iOS 16.4+, the site added to the Home Screen with a manifest `display` of `standalone`/`fullscreen`, a permission request triggered by direct user interaction, and allowing `*.push.apple.com` endpoints; no Apple Developer Program membership needed — [WebKit blog, 2023-02-16](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

### Inferences
- Recommended: public booking pages double as a lightweight PWA (live queue status page reachable from a WhatsApp link, no install required), while the full patient app (family profiles, push, offline) is native Android via RN/Expo. This also covers iOS users until the iOS app ships.
- Android web push uses FCM under the hood in Chrome, so it inherits the same Syria availability questions as native FCM (inference).

### Gaps
- No 2026 data on PWA install rates or Android web-push opt-in rates was found.

---

## 11. Printing from the web: thermal receipts (58/80 mm) with Arabic, A5/A4

### Takeaway
Cheap ESC/POS printers usually lack Arabic code pages and shaping, so Arabic receipts should be sent as raster images (render text to canvas → dither → `GS v 0`) or printed through the OS driver via the browser's print pipeline. WebUSB/Web Serial work in Chromium but have driver and permission friction on Windows; QZ Tray is the mature local agent but its production use needs a paid annual support/key-pair subscription.

### Cited Findings
- QZ Tray: free download for demo use (with warnings); production "trusted key pair" comes with the support subscription — standard support QZ-001 at $549/year (2-year) down to $449/year (4–5 years), each year including a trusted key pair, updates and support; company-branded (white-label) from $2,999 (multi-year $2,749–$2,249/year); a sponsored $0 tier requires application — [QZ store: Premium Support](https://buy.qz.io/Premium-Support-_p_13.html); [QZ store: Company Branded](https://buy.qz.io/Company-Branded-Premium-Support_p_19.html); [QZ store: Sponsored Support](https://buy.qz.io/Sponsored-Support_p_24.html)
- A Dec 2025 community question asked whether QZ Tray licensing is per application, vendor or device for multi-tenant SaaS; no public answer shown — [qz-print Google Group](https://groups.google.com/g/qz-print/c/R1WYSkp3TTk)
- QZ Tray is open source on GitHub ("Browser plugin for sending documents and raw commands to a printer"), topics include escpos, epl, zpl, star, epson, zebra — [GitHub: qzind/tray](https://github.com/qzind/tray)
- WebUSB works only in secure contexts and `requestDevice()` needs a user gesture; on Windows devices need Microsoft OS 2.0 descriptors (Windows 8.1+) or a manually installed INF; Linux needs udev rules — [Chrome developers: WebUSB](https://developer.chrome.com/docs/capabilities/usb)
- Web Serial arrived on Chrome for Android (Chrome 148 beta, April 2026); only devices exposing wired serial ports return ports; not supported in Firefox Android, Samsung Internet or Opera Mobile — [Notebookcheck](https://www.notebookcheck.net/Chrome-148-Beta-for-Android-adds-Web-Serial-SharedWorker-support.1269721.0.html); [blink-dev Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/HBJ-uYFvkpM); [TestMu compatibility](https://www.testmuai.com/web-technologies/web-serial/)
- `thermoprint` library converts images to ESC/POS raster with Floyd–Steinberg dithering (example dithers canvas pixel data to 384 px wide), and offers `webserial`/`webusb` transports — [docs.rs: thermoprint](https://docs.rs/crate/thermoprint/0.3.0) (project claims, not verified)

### Inferences
- **Recommended tiered approach**:
  1. **Default: browser print (`window.print`) of an HTML receipt** sized with CSS `@page { size: 80mm auto; margin: 0 }` (or 58 mm) and A5/A4 templates for prescriptions/invoices. The Windows printer driver renders Arabic glyphs correctly because the driver rasterises; Chrome/Edge can print silently in kiosk setups (`--kiosk-printing` flag, prior knowledge, not re-verified). Works offline, no extra software, same templates for PDF.
  2. **Direct ESC/POS (optional)**: for USB/serial/Bluetooth printers without good drivers, render the receipt to a canvas with an Arabic font, dither to 384 px (58 mm) or 576 px (80 mm), send `GS v 0` raster via WebUSB/Web Serial/Web Bluetooth; add cash-drawer kick and auto-cut commands. Caveat: on Windows a device already claimed by a vendor driver is typically not accessible to WebUSB (prior knowledge), so this suits Android tablets or driverless setups.
  3. **Local print agent** when silent multi-printer routing is needed (receipt to thermal, prescription to laser): QZ Tray (budget ~$449–549/year for a trusted key pair; clarify multi-tenant licensing with QZ) or a small in-house agent (e.g. a tray app exposing `localhost` WebSocket) — inference.
- Label printers (ZPL/EPL for sample tubes, file labels) are also covered by QZ raw printing; for driver-based label printers, browser print with exact `@page` size works.
- Always generate receipts from structured data (not screenshots) so the same template prints thermal, A5, PDF or WhatsApp-shareable image.

### Gaps
- No 2026 tutorial confirming an end-to-end Arabic raster ESC/POS pipeline over WebUSB in plain JavaScript was found.
- WebUSB status on Chrome for Android in 2026 not confirmed by a primary source (prior knowledge: supported since Chrome 61).
- Chrome's current flags/policies for silent printing were not verified.
- QZ Tray licence (LGPL per prior knowledge) and current release were not confirmed from the repository page.

---

## 12. Waiting-room TV display with voice announcements

### Takeaway
Browsers block audible autoplay and `speechSynthesis.speak()` without user activation; on managed kiosk devices this is solved by a kiosk browser setting or policy. Fully Kiosk Browser supports HTML5 audio autoplay and keep-screen-on, but the Web Speech API is not supported in Android WebView, so TTS must go through Fully's JS API or pre-recorded audio.

### Cited Findings
- MDN (modified 2026-09-10): autoplay with sound is allowed if muted/zero volume, the user has interacted with the site, the site is allowlisted (by engagement or manually), or the `autoplay` Permissions Policy grants it; `play()` rejects with `NotAllowedError` when blocked; `navigator.getAutoplayPolicy("mediaelement" | "audiocontext")` reports `allowed`/`allowed-muted`/`disallowed` — [MDN: Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- Chrome made `speechSynthesis.speak()` without user activation fail ("not-allowed") since M71 (≈Dec 2018) — [blink-dev: Intent to Deprecate](https://groups.google.com/a/chromium.org/g/blink-dev/c/XpkevOngqUs); [blink-dev: Intent to Remove](https://groups.google.com/a/chromium.org/g/blink-dev/c/WsnBm53M4Pc)
- Chrome devices in managed kiosk mode are not affected; otherwise `chrome://flags/#autoplay-policy` → "No user gesture is required" — [TelemetryTV docs](https://docs.telemetrytv.com/docs/googles-autoplay-policy) (third-party)
- Fully Kiosk Browser: autoplay for HTML5 video/audio, "Keep screen on" option, TTS through Fully's JavaScript API because the Web Speech API is not (fully) supported by Android WebView; Android TV devices can have serious restrictions; Keep-Screen-On issues on some Android 11+ devices addressed by "Keep Screen On (Advanced)" in 1.44+ — [Fully Kiosk: all features](https://www.fully-kiosk.com/docs/en/features/all); [Fully Kiosk: known issues](https://www.fully-kiosk.com/docs/en/features/known-issues)
- Fully licensing is a one-time per-device licence with an optional recurring Fully Cloud subscription — [Capterra UK](https://www.capterra.co.uk/software/156468/fully)

### Inferences
- **Recommended**: the TV page is a route of the clinic web app (read-only, tenant + display token), subscribing to queue events via WebSocket/SSE with polling fallback; on an Android TV box run Fully Kiosk (PLUS licence) with autoplay enabled and Keep-Screen-On (Advanced). For the voice, prefer **pre-recorded Arabic audio segments** ("الرقم" + number + "إلى العيادة" + room) concatenated client-side: deterministic, works offline, avoids missing Arabic TTS voices on cheap boxes. Add a chime before each call.
- **Runner-up**: a plain Chromium-based browser on a mini-PC in kiosk mode with the autoplay policy/flag set, plus Web Speech or cloud TTS.
- Keep a one-tap "enable sound" overlay as a fallback when `getAutoplayPolicy` returns `disallowed`.

### Gaps
- Current Fully Kiosk PLUS licence price could not be retrieved (page moved).
- Availability/quality of Arabic TTS voices on low-cost Android TV boxes not found.

---

## 13. Maps (clinic location on booking pages, patient app)

### Takeaway
Google Maps Platform is risky for Syria (Syria appeared on its prohibited-territories list; current status unconfirmed). OpenStreetMap-based rendering (MapLibre GL or Leaflet) with self-hosted or free vector tiles avoids billing/sanctions exposure and supports Arabic labels.

### Cited Findings
- Syria appears on Google Maps Platform's prohibited-territories list (snippet from a version dated March 2022; current page not readable) — [Google Maps Platform prohibited territories](https://cloud.google.com/maps-platform/terms/maps-prohibited-territories)
- Google's Places Insights coverage table lists Syria as covered (data coverage, not billing availability) — [Places Insights coverage](https://developers.google.com/maps/documentation/places-insights/coverage)

### Inferences
- **Recommended**: MapLibre GL JS (web) / MapLibre Native or a WebView/static image (mobile) with OpenStreetMap data; self-host a regional PMTiles extract (Syria + southern Turkey) to stay independent of third-party tile quotas; use `name:ar` labels where present with fallback to `name`. Booking pages: a static map image + "open in Google Maps/OSM" deep link (opening the Google Maps app on the user's phone is not a Maps Platform API call).
- **Runner-up**: Leaflet with a raster OSM tile provider (simpler, lighter on low-end phones, weaker label control).

### Gaps
- MapLibre/Leaflet versions, Protomaps/OpenFreeMap terms, and OSM Arabic label coverage for Aleppo/Azaz were not researched (search budget exhausted).
- Current Google Maps Platform prohibited-territories list not confirmed.

---

## 14. Internationalization: plurals, digits, dates

### Takeaway
Arabic needs all six CLDR plural categories, and browser defaults for Arabic digits are inconsistent across vendors, so the app should set the numbering system explicitly (tenant/user preference) rather than rely on `ar-SY` defaults.

### Cited Findings
- CLDR Arabic cardinal plural categories: zero (0), one (1), two (2), few (n%100 = 3..10), many (n%100 = 11..99), other (e.g. 100–102, decimals) — [CLDR language plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
- CLDR base `ar` defaults to Arabic-Indic (`arab`) digits while Maghreb locales (ar_MA, ar_DZ) default to `latn` — [W3C i18n archive, 2017](https://lists.w3.org/Archives/Public/public-i18n-archive/2017JanMar/0406.html) (dated)
- WebKit bug reports note CLDR offers both `arab` and `latn` for Arabic with `arab` as default, while some vendors default to ASCII digits; ar-AE output differs across browsers — [WebKit bug 236121](https://bugs.webkit.org/show_bug.cgi?id=236121); [WebKit bug 218139](https://auto-bugs.webkit.org/show_bug.cgi?id=218139)
- CLDR's ar_SY chart defines number symbols for both `arab` and `latn` — [CLDR chart ar_SY (v24)](https://unicode.org/cldr-aux/charts/24/summary/ar_SY.html)
- DayPicker Hijri defaults to Arabic-Indic digits, switchable with `numerals="latn"` — [DayPicker Hijri](https://daypicker.dev/localization/hijri)

### Inferences
- Use ICU MessageFormat with full Arabic plural support (i18next with ICU plugin, FormatJS/react-intl, Lingui, or Paraglide all support CLDR plurals via `Intl.PluralRules` — prior knowledge, not re-verified). For a TS monorepo shared with React Native, **i18next + react-i18next** (largest ecosystem, works in RN) is the pragmatic choice; **Lingui** (compile-time, smaller runtime) is a strong runner-up; Paraglide is attractive for type-safe, tree-shaken messages on the booking pages.
- Always format with `Intl.NumberFormat('ar-SY', { numberingSystem: 'latn' | 'arab' })` from a tenant/user setting; default to Latin digits for phone numbers, IDs, receipt numbers and amounts that are typed/compared (avoids mixed-digit input bugs), and normalise Arabic-Indic and Persian digits to ASCII on input. Currency: SYP (and possibly TRY/USD in Azaz); store minor units as integers with a currency code per tenant.
- Dates: store UTC/ISO; display Gregorian with Arabic month names (Syrian usage: كانون الثاني، شباط… differs from Egyptian/Gulf يناير، فبراير — `ar-SY` CLDR uses the Levantine names per prior knowledge; verify); Hijri optional.

### Gaps
- No authoritative source found on Syrian user preference between Arabic-Indic and Latin digits in digital apps.
- i18next vs Lingui vs Paraglide 2026 versions/bundle sizes not verified.
- `ar-SY` month-name output across Chrome/Android WebView not verified.

---

## 15. Testing and design tooling

### Takeaway
Not researched with 2026 sources due to the search budget; recommendations below are prior-knowledge defaults.

### Cited Findings
- (none gathered this session)

### Inferences
- Web: Vitest (unit/component, with Testing Library) + Playwright (E2E, including offline mode via `context.setOffline(true)`, RTL screenshot tests, print-to-PDF snapshots of receipts) — prior knowledge.
- Mobile (RN/Expo): Jest + React Native Testing Library; Maestro for E2E flows on real low-end Android devices — prior knowledge. If Flutter: `flutter_test` + `integration_test`, Patrol for native interactions.
- Design: Figma with an RTL-first component library mirroring shadcn tokens; Figma's MCP server can feed Claude Code during implementation.

### Gaps
- Vitest/Playwright/Maestro 2026 versions and Figma RTL tooling were not verified.

---

## 16. Recommended stack per layer (layer → choice → runner-up → why)

### Takeaway
A TypeScript/React-centric stack maximises code sharing (web, mobile, backend), AI-assistant effectiveness and RTL maturity, with offline handled by a service-worker SPA plus a local SQLite/IndexedDB store and a sync layer. Each choice below follows from the cited findings in sections 1–15; items marked † rely partly on prior knowledge not re-verified in this session.

### Cited Findings
- See sections 1–15 for all sources; key anchors: React 83.6% usage / Next.js 59% meta-framework usage ([InfoQ](https://www.infoq.com/news/2026/03/state-of-js-survey-2025)); shadcn RTL ([shadcn](https://ui.shadcn.com/docs/changelog/2026-01-rtl)); React Router v8 ([Remix](https://remix.run/blog/react-router-v8)); TanStack Start 1.0 ([TanStack](https://tanstack.com/blog/tanstack-start-1-0)); Expo SDK 58 ([Expo](https://expo.dev/changelog/sdk-58)); PowerSync pricing/SDKs ([PowerSync](https://www.powersync.com/pricing)); QZ pricing ([QZ](https://buy.qz.io/Premium-Support-_p_13.html)); OHIF iframe ([OHIF](https://docs.ohif.org/deployment/iframe)).

### Inferences

| Layer | Recommended choice (Nov 2026) | Runner-up | Why |
|---|---|---|---|
| Clinic web app framework | Vite + React 19 + TypeScript + TanStack Router (SPA, static hosting) | React Router v8 in SPA mode (`ssr:false`) | Offline core must run with no server; static SPA shell + service worker is simplest; avoids Next.js server/RSC surface and its frequent security releases; TanStack Router's typed search params suit dense filtered screens. TanStack Start only stable since 2026-10-13, so not yet for the core. |
| Offline/PWA | Service worker via Workbox (`vite-plugin-pwa`) or `@serwist/vite`† (precache shell, runtime cache for reference data) | Serwist in Next.js (webpack/Turbopack guide) | Mature precaching + offline fallback; keep data offline in a DB, not in HTTP cache. |
| Public booking pages | Next.js 16.4 App Router (ISR/`use cache` per tenant, `proxy.ts` tenant resolution for subdomains → custom domains), self-hosted Node behind a TLS proxy† | Astro (React islands for slot picker) | Best-documented multi-tenant subdomain/custom-domain pattern, SEO, stable Adapter API for self-hosting; shares React components and Tailwind tokens with the SPA. Astro ships less JS on 3G but adds a second framework. |
| Super-admin panel | Same SPA stack (separate route bundle/app in the monorepo) | Refine/React-Admin on the same stack† | Reuse components, auth and API client; no SEO needs. |
| UI components | shadcn/ui (Radix or Base UI 1.x primitives) with `rtl: true` + Tailwind CSS v4.3 logical utilities | Ant Design 6 (or Mantine 8 for a lighter look) | Official RTL CLI since Jan 2026; code lives in repo (AI-editable, no lock-in); accessible primitives; same tokens across web surfaces. AntD wins on out-of-the-box dense-data widgets. |
| Data tables | TanStack Table + TanStack Virtual† | AG Grid Community (MIT; grouping/Excel export are Enterprise) | Headless, RTL controlled by our CSS, fits shadcn styling; AG Grid only if spreadsheet-like editing is required. |
| Date picker | react-day-picker (shadcn Calendar) + DayPicker Hijri build for optional Hijri | `@fk6/react-datepicker` (moment-hijri) | Native shadcn integration, Arabic labels, RTL, digit control; Umm al-Qura range 1924–2077. |
| Arabic fonts | IBM Plex Sans Arabic (UI) + Noto Naskh Arabic (print/long text), self-hosted subsetted WOFF2† | Cairo / Tajawal / Noto Kufi Arabic† | Legible at small sizes in dense screens; OFL licences†; offline-capable when self-hosted. |
| Forms & validation | React Hook Form + Zod 4 + in-house JSON-template renderer mapping field types to shadcn components | TanStack Form v1 + Zod 4 | RHF has the largest ecosystem and smallest bundle; custom renderer keeps clinical widgets, RTL and print layouts under control. TanStack Form if strict nested typing outweighs ecosystem. |
| Server state / client state | TanStack Query (with persistence) + Zustand for UI state† | TanStack Query + Jotai† | De-facto standards, well known to AI assistants. |
| Offline local DB & sync | PowerSync (self-hosted Open Edition; web SDK on OPFS/wa-sqlite; same sync rules for RN app) | Dexie.js (IndexedDB) + custom outbox with idempotency keys† | One sync model across web and mobile, Postgres-backed; Dexie is simpler if offline scope stays limited to queue/walk-ins/receipts. Pin versions (web SDK 2.x had breaking/VFS fixes in 2026). |
| Odontogram / perio / ortho charts | Custom React SVG components (data-first state, ARIA, Pointer Events), using react-odontogram (MIT) only as reference | react-konva canvas | Element counts are small (SVG sweet spot); vector print/PDF; accessibility; reusable in RN via react-native-svg. |
| Skeleton / body pain chart | Layered SVG (front/back, joints & regions as named paths with laterality) + canvas overlay for freehand pain drawing; art from CC BY 4.0 Servier Medical Art or commissioned | Full react-konva scene | Same benefits as above; canvas only where freehand drawing needs it. |
| DICOM viewer | OHIF v3 (3.12 stable / 3.14 beta) as a separate app on same origin under `/viewer`, embedded via iframe + postMessage, kept LTR | Cornerstone3D 4.x directly in React for inline thumbnails/simple 2D stacks | Script-tag embedding deprecated; iframe is the documented path; avoids maintaining a viewer; no RTL support documented. |
| Patient mobile app | React Native (New Architecture) + Expo SDK 58 (RN 0.88, Hermes), Android-first; RTL fixed at build/first launch; EAS Update for OTA | Flutter 3.44+ with Shorebird OTA | TypeScript sharing (schemas, API client, i18n, rules), react-native-svg chart reuse, AI proficiency; RN RTL restart quirk avoided by Arabic-first config. Flutter wins on RTL-without-restart and low-end rendering consistency. |
| Mobile offline DB | PowerSync React Native SDK (or expo-sqlite/op-sqlite + outbox)† | WatermelonDB† | Same sync rules as web; SQLite on device. |
| Mobile OTA | EAS Update (Free 1k MAU; Starter $19 / 3k; Production $199 / 50k) | Self-hosted expo-updates server†; (Flutter: Shorebird Pro $20 / 50k installs) | Cheap at expected scale; confirm payment with Turkish company card. |
| Push notifications | FCM via Expo Notifications / react-native-firebase, accounts under the Turkish entity; in-app WebSocket/polling fallback for live queue | WhatsApp messages for critical notices | Google services only partially restored in Syria; Play Console reportedly still excludes Syria as account country. |
| Patient web (no install) | PWA-capable booking/queue pages (Next.js) linked from WhatsApp | — | Covers iOS users before the iOS app; iOS web push needs Home-Screen install (16.4+). |
| Receipt / document printing | HTML templates + CSS `@page` (80/58 mm, A5, A4) via browser print through OS drivers (silent via kiosk printing flag†) | QZ Tray agent (~$449–549/yr key pair) or WebUSB/Web Serial raster ESC/POS (canvas → dither → `GS v 0`) | Arabic shaping is handled by the OS driver; works offline; raw ESC/POS lacks Arabic code pages on cheap printers, so raw path must send raster images. |
| Waiting-room display | Web route of the clinic app on Android TV box in Fully Kiosk Browser (autoplay on, Keep Screen On Advanced) with pre-recorded Arabic audio segments | Chromium kiosk on mini-PC with autoplay policy flag + Web Speech/cloud TTS | Autoplay/TTS require user activation unless kiosk settings allow; Android WebView lacks Web Speech API; recorded audio is deterministic and offline. |
| Maps | MapLibre GL JS + OpenStreetMap (self-hosted regional PMTiles, `name:ar` labels)† | Leaflet + raster OSM tiles† | Syria listed in Google Maps Platform prohibited territories (status unconfirmed); no billing/sanctions exposure. |
| i18n | i18next + react-i18next with ICU (shared web + RN), explicit `numberingSystem` per tenant/user† | Lingui (compile-time)† | Arabic needs 6 plural forms; browser digit defaults vary; one catalog for web and mobile. |
| Testing | Vitest + Testing Library; Playwright (offline, RTL, print snapshots)†; Maestro for mobile E2E† | Cypress†; Detox† | Standard, AI-friendly tooling; Playwright can emulate offline and print to PDF. |
| Design tooling | Figma with RTL-first component library mirroring shadcn tokens† | Penpot† | Team standard; Figma MCP integrates with Claude Code. |

### Gaps
- Items marked † were not re-verified with November 2026 sources because the web-search budget was exhausted; the report writer should present them as reasoned defaults, not verified facts.
- Vue/Nuxt, SvelteKit and Angular were not evaluated with current evidence, so the React recommendation is based on ecosystem share, RTL library maturity and code-sharing arguments rather than a full head-to-head.
- Syria-specific availability of Firebase/FCM, Google Maps Platform and Play Console for developers remains the largest unresolved external risk and should be checked directly with Google before launch.
