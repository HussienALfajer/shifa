# Backend, Data & Infrastructure Stack for a Multi-Tenant Healthcare SaaS (Syria: Aleppo/Azaz) — evidence as of 2026-11-07

Scope note: evaluated neutrally per layer (no stack assumed). Research was web-only. The shared web-search budget ran out partway through, so some layers (BullMQ, Temporal, Socket.IO/uWS, Typesense/OpenSearch, Hetzner/R2/B2 object storage, Turkish hosting, pgBackRest/WAL-G/Barman, Grafana/OTel, Kysely/MikroORM, Zod 4/Valibot/TypeBox, dinero.js, FHIR libraries, WAHA, Gotenberg/WeasyPrint, RxDB/Dexie Cloud, hiring data) have no fresh 2026 citations. They appear under **Gaps**, clearly marked as unverified background knowledge, so the report writer can weigh them.

---

## 1. Language / framework (TypeScript vs .NET vs Laravel vs Go vs Python)

### Takeaway
TypeScript on Node (NestJS 12, released Aug 2026, now at 12.4.0) is the best fit. It has the largest language and runtime population, gives a modular-monolith structure out of the box, shares types with the web front end, and is very common in AI-assistant training data. .NET 10 LTS (ASP.NET Core, optionally ABP's open-source tier) is the strongest runner-up on typing and performance. However, ABP's multi-tenancy features that matter here (SaaS editions, separate tenant DBs, management UI) are commercial.

### Cited Findings
- **Stack Overflow 2025 usage (all respondents / professionals):**
  - Languages: TypeScript 43.6% / 48.8%, JavaScript 66% / 68.8%, Python 57.9% / 54.8%, C# 27.8% / 29.9%, Java 29.4%, PHP 18.9% / 19.1%, Go 16.4% / 17.4%, Dart 5.9%.
  - Web frameworks: Node.js 48.7%, ASP.NET Core 19.7%, Express 19.9%, NestJS 6.7% / 7.4%, Laravel 8.9%, Django 12.6%, FastAPI 14.8%, Spring Boot 14.7%.
  - Source: [Stack Overflow Survey 2025 – Technology](https://survey.stackoverflow.co/2025/technology/)
- **NestJS releases:**
  - Latest is v12.4.0 (2026-11-06); v12.3.0 (2026-10-27/28), v12.2.0 (2026-10-19), v12.1.3 (2026-10-12) — [GitHub nestjs/nest releases](https://github.com/nestjs/nest/releases)
  - The 11.x line still receives patches (v11.2.8, 23 Oct) — [GitHub nestjs/nest releases](https://github.com/nestjs/nest/releases)
- **NestJS 12.0.0 (GitHub release dated 27 Aug 2026):**
  - @nestjs/config moves from Joi-specific validation to Standard Schema.
  - Webpack CLI workflows are deprecated in favour of `--builder rspack`.
  - The CLI is now native ESM, but CommonJS apps keep working and migrating to ESM is optional.
  - `nest upgrade` automates the migration.
  - Sources: [NestJS v12.0.0 release](https://github.com/nestjs/nest/releases/tag/v12.0.0); [DEV deep-dive on NestJS 12](https://dev.to/x4nent/nestjs-12-deep-dive-full-esm-migration-standard-schema-route-validation-and-the-4fe0)
- **NestJS 11 adapters and Node:** Express 5 became the default adapter, @nestjs/platform-fastify v11 supports Fastify v5, and Node 20+ is required — [NestJS migration guide](https://docs.nestjs.com/migration-guide)
- **.NET 10** is an LTS release supported until November 2028 (one source gives 2028-11-14) — [endoflife.ai .NET 10](https://endoflife.ai/dotnet/10)
- **ABP versions and support:** ABP versions track .NET (ABP 10.x on .NET 10). The ABP release-info page lists ABP 10 active support ending 2026-11 and LTS ending 2027-11. The 10.5 docs instead state "2 years of support per major", so the two pages conflict — [ABP Versioning & Releases](https://abp.io/docs/latest/release-info); [ABP 10.5 release info](https://abp.io/docs/10.5/release-info)
- **ABP free vs commercial:**
  - The open-source tier has only basic tenant management. The commercial SaaS module adds edition management, a management UI, automatic DB migration and separate tenant database support.
  - Identity Pro and Account Pro are commercial. They add 2FA, LDAP/AD login, account linking, and user/tenant impersonation.
  - ABP Suite (the code generator) is commercial. LeptonX is commercial; LeptonX Lite is free.
  - React UI and the ABP Studio AI Agent (credit-based) are license-holder features.
  - Sources: [ABP Free vs Pro licenses](https://abp.io/docs/latest/others/free-licenses-vs-pro-licenses); [ABP Framework vs ABP Commercial](https://github.com/abpio/abp-commercial-docs/blob/master/en/abp-framework-vs-abp-commercial.md)
- **Laravel 13:**
  - Requires PHP ≥ 8.3 — [Laravel 13 release notes](https://laravel.com/docs/13.x/releases.md)
  - Released 2026-03-17 per a third-party blog (date not confirmed officially) — [icoderzsolutions](https://icoderzsolutions.com/blog/laravel-13-is-released)
  - Bug fixes through Q3 2027 and security fixes through Q1 2028 — [Laravel News](https://laravel-news.com/laravel-13-released)
- **stancl/tenancy:**
  - v4 requires PHP 8.4+ and Laravel 12+, and adds PostgreSQL RLS support, early identification and a routing overhaul — [Tenancy v4 changelog](https://v4.tenancyforlaravel.com/changelog)
  - Laravel 13 support is confirmed only for v3.10.0 (2026-03-18) — [LaraPlugins stancl/tenancy](https://laraplugins.io/plugins/stancl/tenancy?page=5)
  - Packagist metadata is stale: last updated 2025-09, with constraints up to ^12 — [Packagist](https://packagist.org/packages/stancl/tenancy)

### Inferences
- **Why TypeScript and NestJS:**
  - TS has about 49% professional usage, and Node.js is the #1 web technology. That makes TS the most likely language for which AI coding assistants produce idiomatic, correct code. The same pool also covers web front-end hiring.
  - NestJS adds modules, DI, guards and interceptors, which map directly onto a modular monolith (scheduling, queue, EMR, billing, imaging, notifications). NestJS-specific usage is small (6.7%), but it sits on the large Node/TS base.
  - The NestJS 12 changes (ESM CLI, Standard Schema, rspack) are low-risk for a greenfield project. Start directly on 12.x with the Fastify adapter or the Express 5 default.
- **Hono / Fastify alone / AdonisJS:** Hono and plain Fastify are lighter but leave modularity, DI and conventions to the team. That weakens consistency when several developers and AI agents generate code. AdonisJS is batteries-included but has a smaller ecosystem (no 2026 data gathered; see Gaps).
- **.NET 10:** Technically excellent (LTS to Nov 2028, strong typing, performance). If chosen, plain ASP.NET Core with a hand-rolled tenant model avoids ABP's commercial lock-in, since ABP's free tier lacks the SaaS module. The C# talent pool (about 28%) is decent, but the web front end will probably still be TS, which means two languages.
- **Laravel 13 + stancl/tenancy v4:** Productive, but v4's PHP 8.4+ requirement and the unclear Laravel 13 / v4 release status add risk, and PHP typing is weaker for AI-heavy refactoring.
- **Go:** Great runtime and operations, but it lacks a batteries-included modular-monolith framework.
- **Django:** Strong admin and ORM, and multi-tenancy via django-tenants. Typing is weaker than TS or C#.

### Gaps
- No reliable 2026 data on developer hiring in Syria, Turkey or the region per language. Background knowledge suggests PHP/Laravel and JS are common among Syrian and Turkish freelancers, but this is unverified.
- No benchmark found that measures AI-assistant proficiency per framework. The inference above is from usage share only.
- FHIR libraries were not re-verified this session. Background knowledge, unverified: HAPI FHIR (Java), the Firely .NET SDK (Firely's licensing changed in recent years, so check it), the `@medplum/fhirtypes` TS types (Apache-2.0) and `fhir.resources` (Python). FHIR is a "later" concern for this product (interop with the MoH).
- AdonisJS v6/v7 and Hono 2026 status were not researched.

---

## 2. Database — PostgreSQL version, features, hosting

### Takeaway
Use PostgreSQL 18 now and plan an upgrade to PG 19, which is in RC with a draft GA announcement dated 2026-11-19. PG 18 provides uuidv7(), async I/O, virtual generated columns and OLD/NEW in RETURNING. Syria's Law 12/2024 restricts storing personal data abroad without authorization, so the database must be fully portable (self-hosted, containerized, with no proprietary DBaaS features).

### Cited Findings
- **PostgreSQL 18 (released 2025-09-25):**
  - New async I/O subsystem, with up to 3× faster reads from storage.
  - `uuidv7()` generates timestamp-ordered UUIDs; `uuidv4()` is an alias for `gen_random_uuid()`.
  - Virtual generated columns are now the default; stored generated columns can be logically replicated.
  - OAuth 2.0 authentication; md5 password auth is deprecated in favour of SCRAM.
  - Source: [PostgreSQL 18 Released](https://postgresql.org/about/news/postgresql-18-released-3142/)
  - Secondary coverage adds OLD/NEW values in RETURNING for INSERT/UPDATE/DELETE/MERGE, and data checksums on by default in initdb — [AlternativeTo news](https://alternativeto.net/news/2025/9/postgresql-18-released-with-async-i-o-subsystem-performance-improvements-and-oauth-support)
- **PostgreSQL 19:**
  - Beta 1 released 2026-06-04 — [Devart](https://www.devart.com/blog/postgresql-19-release.html)
  - RC1 docs exist — [pgEdge v19rc1 release notes](https://docs.pgedge.com/postgresql/v19rc1/appendixes/release-notes/release-19/)
  - A draft press release is dated 2026-11-19 and still has a "HOLDING FOR QUOTE" placeholder, so GA is not confirmed as of 2026-11-07 — [PG draft announcement](https://www.postgresql.org/message-id/attachment/207950/release.en.md)
  - Features: `REPACK (CONCURRENTLY)`, `pg_plan_advice`, parallel index processing in autovacuum, initial SQL/PGQ graph queries, temporal DML `UPDATE/DELETE ... FOR PORTION OF`, and sequence replication — [PG draft](https://www.postgresql.org/message-id/attachment/207950/release.en.md); [pgEdge](https://docs.pgedge.com/postgresql/v19rc1/appendixes/release-notes/release-19/); [Peerlist](https://peerlist.io/saxenashikhil/articles/postgresql-19-new-features); [Devart](https://www.devart.com/blog/postgresql-19-release.html)
- **PostgreSQL popularity:**
  - 55.6% of all respondents and 58.2% of professionals use it, versus MySQL 40.5% and SQLite 37.5% — [Stack Overflow 2025](https://survey.stackoverflow.co/2025/technology/)
  - A secondary article cites 49.09% professional usage. This conflicts with the official page; prefer the official figure — [besthub.dev](https://besthub.dev/articles/2025-stack-overflow-survey-hottest-languages-databases-ai-tools-e03da74e42fb)
- **Syria's personal data law:**
  - Law No. 12 of 2024 on electronic personal data protection exists, with a "Personal Data Protection Authority" — [Morrison Foerster Privacy Library – Syria](https://www.mofo.com/privacy-library/syria)
  - Per a secondary summary, it took effect 2025-01-01. Article 15 prohibits transferring, processing or storing personal data in a foreign state unless the competent authority verifies and authorizes adequate protection — [offlist.me summary](https://www.offlist.me/what-is-syria-law-12-2024-electronic-personal-data)
  - The law's status after the transition is described as uncertain and under review per a 2026 SANA report (secondary) — [law.ungovr.org Syria profile](https://law.ungovr.org/ai/sy)
  - A June 2026 Ministry of Justice committee is reviewing several laws, including the cybercrime law — [Amnesty, July 2026](https://www.amnesty.org/en/latest/news/2026/07/syria-suspend-use-of-assad-era-cybercrime-law-pending-reform/)

### Inferences
- **Recommended PG 18 features for this domain:**
  - `uuidv7()` primary keys: index-friendly, and clients can generate IDs offline using UUIDv7 libraries.
  - Exclusion constraints (`btree_gist` + `tstzrange`) to prevent double-booking per doctor and room. This is a long-standing standard PG feature, not re-verified this session.
  - JSONB with GIN indexes for custom fields and template payloads.
  - RLS keyed on `app.tenant_id`.
  - Logical replication or PG18-replicable stored generated columns for a future in-Syria replica or migration.
- **Data residency:** Article 15 implies that hosting patient data outside Syria (Hetzner EU, a Turkish DC) may legally require authorization once the law is enforced. Design for "lift-and-shift": Docker images, no managed-only Postgres extensions, and pgBackRest/WAL-based backups that can be restored anywhere. Get a legal opinion before go-live.
- PG 19's `FOR PORTION OF` (temporal DML) could later simplify versioned clinical templates and price history. Not needed on day one.

### Gaps
- No primary source found for Article 15's exact text (an Arabic original is linked from MoFo at moct.gov.sy). No Ministry of Health rule specific to health-data hosting was found.
- Managed Postgres options payable from Turkey (Turkish clouds, Gulf regions) were not researched. Hetzner has no managed PG (background knowledge, unverified).

---

## 3. TypeScript ORM / query builder — RLS session variables per transaction

### Takeaway
Drizzle is the cleanest fit for RLS-based multi-tenancy:
- `pgPolicy`, `pgRole` and `withRLS` live in the schema and drizzle-kit migrations.
- An explicit `tx` handle makes "BEGIN; set_config('app.tenant_id', $1, true); …" a trivial wrapper.
- The caveat is that v1.0 is still RC (rc.5, 2026-10-21).

Prisma 7 (stable, Rust-free since 2025-11-19) works, but RLS needs client-extension tricks that interfere with `$transaction`. Prisma 8 (in RC) adds native `@@rls` policies. TypeORM reached 1.0 in May 2026 under new maintainers.

### Cited Findings
- **Drizzle releases:** v1.0.0-rc.5 (2026-10-21) and rc.4 (2026-06-27). No stable 1.0 yet; the sidebar shows "v1.0 99.5%" — [Drizzle latest releases](https://orm.drizzle.team/docs/latest-releases)
- **Drizzle RLS API** — [Drizzle RLS docs](https://orm.drizzle.team/docs/rls):
  - Schema-level: `pgTable.withRLS(...)`, `pgRole(...)` (`.existing()`), and `pgPolicy(..., {as, to, for, using, withCheck})`.
  - `crudPolicy` (Neon) and Supabase helpers.
  - Role management is opt-in via `entities.roles` in drizzle.config.
  - The official Supabase example opens a transaction, calls `set_config(..., TRUE)` (transaction-local) and `set local role`, then runs the callback and resets the role. It builds SQL with `sql.raw` interpolation, so parameterize in your own wrapper.
- **Conflict on policy migrations:** A third-party guide claims drizzle-kit does not generate RLS policies (you write manual SQL), which conflicts with the official docs — [ecosire guide](https://ecosire.com/blog/drizzle-orm-postgres-rls-multitenancy)
- **Pooling pitfalls** — [ecosire guide](https://ecosire.com/blog/drizzle-orm-postgres-rls-multitenancy):
  - `set_config(..., true)` is transaction-scoped.
  - A session-scoped setting on a pooled connection leaks the tenant to the next request.
  - With transaction pooling, use `server_reset_query = DISCARD ALL`.
- **Superuser bypass:** RLS was ignored because the app connected as a superuser; a non-BYPASSRLS role is required — [AnswerOverflow thread](https://www.answeroverflow.com/m/1430267647701815398)
- **Prisma 7:**
  - v7.0.0 (2025-11-19) makes the Rust-free client the default. v7.4 adds query caching — [Prisma changelog](https://www.prisma.io/changelog.md)
  - v7.3 adds a `compilerBuild` fast/small option and lets raw queries bypass the compiler — [Prisma 7.3 blog](https://blog.prisma.io/blog/prisma-orm-7-3-0)
  - Prisma's own AMA says v7 performance vs v6 is mixed: better for large results and raw queries, with compilation overhead elsewhere — [Prisma 7 AMA](https://www.prisma.sh/blog/prisma-7-ama-clearing-up-the-why-behind-the-changes)
- **Prisma RLS patterns:**
  - A Prisma 5-era `$allOperations` extension wraps every query in a batch transaction, which breaks explicit `$transaction` and needs a separate override — [Zenn article](https://zenn.dev/sawachon/articles/c1c7fe658fe2c6)
  - Prisma lists an official `row-level-security` client-extension example for v7 — [Prisma v7 extension examples](https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions/extension-examples)
  - The community `prisma-rls` package notes that the v7 `prisma-client` generator broke its DMMF handling — [e965/prisma-rls](https://github.com/e965/prisma-rls)
- **Prisma ORM 8 (RC, docs reference 8.0.0-rc.23):**
  - Native `@@rls` on models, with `policy_select`/`policy_update` blocks in the schema.
  - Docs say to set `app.user_id` via `set_config` inside `db.transaction`.
  - The table owner bypasses RLS, and `FORCE ROW LEVEL SECURITY` needs raw SQL.
  - Source: [Prisma docs – advanced PostgreSQL](https://www.prisma.io/docs/orm/contract-authoring/advanced-postgresql)
- **TypeORM:**
  - 1.0 shipped in May 2026 after about a decade pre-1.0 — [InfoQ](https://www.infoq.com/news/2026/06/typeorm-1-released/)
  - New maintainers took over at the end of 2024. In 2025 they merged 575 PRs (vs 63 the year before) and closed over 2,300 issues — [TypeORM blog](https://typeorm.io/blog/future-of-typeorm)

### Inferences
- **Recommended Drizzle setup:** pin Drizzle (0.x stable, or 1.0 RC if the team accepts it) and add one wrapper:
  - `withTenant(ctx, fn) = db.transaction(tx => { tx.execute(sql\`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${userId}, true)\`); return fn(tx) })`
  - Every repository receives `tx`, never the global `db`.
  - Use a dedicated non-owner app role, plus `FORCE ROW LEVEL SECURITY` on tenant tables.
  - This is explicit and AI-assistant-friendly (SQL-like), and works with any pooler in transaction mode.
- **Prisma:** the runner-up. It has better DX and a richer ecosystem, but RLS plumbing in v7 is extension-based and awkward with interactive transactions. Re-evaluate when Prisma 8 (native `@@rls`) goes GA.
- **TypeORM:** 1.0 is now viable again, but the community has largely moved to Drizzle and Prisma for new TS projects. No hard 2026 data was gathered on that point.
- **Kysely:** a solid escape hatch for complex reporting SQL, alongside Drizzle (not re-verified).

### Gaps
- Kysely, MikroORM 6/7 and TypeORM RLS patterns were not researched this session (search budget exhausted).
- No independent 2026 benchmark of Drizzle vs Prisma 7 was gathered.

---

## 4. Offline sync for the clinic reception (offline WRITES + conflict handling)

### Takeaway
PowerSync is the only mature option found that does true offline writes on both Flutter and web against Postgres:
- Local SQLite with an upload queue.
- Your backend applies writes and resolves conflicts.
- As of 2026-11-03 its self-hosted service is Apache 2.0 (previously FSL).

Electric is read-path only (writes go through your API). Zero 1.0 explicitly lacks offline writes. Triplit's team dissolved into Supabase. The runner-up is a custom outbox (idempotent command log plus server-side conflict rules).

### Cited Findings
- **PowerSync license change:**
  - A note dated 2026-11-03 says the core PowerSync Service moved from FSL to Apache 2.0. Client SDKs are Apache 2.0/MIT.
  - The Dashboard is excluded from Open Edition. Cloud and Enterprise Self-Hosted remain commercial.
  - Sources: [PowerSync "new open era" post](https://powersync.com/blog/new-open-era-for-powersync); [PowerSync Fair Source post](https://www.powersync.com/blog/powersync-supports-fair-source)
  - Earlier, the FSL's only restriction was offering a competing paid product, with conversion to Apache 2.0 after 2 years — [PowerSync Fair Source post](https://www.powersync.com/blog/powersync-supports-fair-source)
- **PowerSync pricing** — [PowerSync pricing](https://powersync.com/pricing):

| Plan | Price | Data synced / month | Hosted data | Peak concurrent clients |
|---|---|---|---|---|
| Cloud Free | $0 | 2 GB | 500 MB | 50 |
| Pro | from $49/mo | 30 GB, then $1/GB | 10 GB, then $1/GB | 1,000, then $30 per 1,000 |
| Team | from $599/mo | — | — | — |
| Open Edition (self-hosted) | free | — | — | — |
| Enterprise Self-Hosted | custom | — | — | — |

  - Free projects are deactivated after 1 week of inactivity.
- **PowerSync write path:**
  - Local writes go to SQLite plus an upload queue (blocking FIFO), drained sequentially against developer-configured backend endpoints.
  - The client doesn't advance checkpoints while changes are queued, so it never resolves conflicts locally.
  - The default is per-field last-write-wins as received by the server.
  - Custom resolution happens in the backend; the docs example is two offline clerks decrementing the same inventory.
  - Sources: [PowerSync – handling update conflicts](https://docs.powersync.com/handling-writes/handling-update-conflicts); [custom conflict resolution](https://docs.powersync.com/handling-writes/custom-conflict-resolution)
- **PowerSync maturity:**
  - Flutter SDK release notes (v1.11.2) list Flutter Web as Beta, with `dart run powersync:setup_web` automating the wasm/worker setup — [PowerSync Flutter SDK announcement](https://releases.powersync.com/announcements/flutter-client-sdk)
  - Self-hosting docs described Open Edition as beta and without the dashboard (search summary) — [PowerSync self-hosting docs](https://docs.powersync.com/intro/self-hosting)
- **ElectricSQL:**
  - Writes stay explicit through your existing API, with a txid handshake to confirm sync — [Electric blog, 2026-03-25](https://electric-sql.com/blog/2026/03/25/tanstack-db-0.6-app-ready-with-persistence-and-includes); [third-party Electric skill page](https://skillselion.com/skills/oakoss/agent-skills/electricsql)
  - TanStack DB 0.6 added persistence — [Electric blog, 2026-03-25](https://electric-sql.com/blog/2026/03/25/tanstack-db-0.6-app-ready-with-persistence-and-includes)
  - TanStack DB was still labelled BETA at 0.6.11 (June 2026 mirror) — [TanStack DB mirror](https://upd.dev/TanStack/db/src/@tanstack/db@0.6.11)
- **Zero (Rocicorp):**
  - 1.0 is a "very minor update to 0.26.2" — [Zero 1.0 release notes](https://zero.rocicorp.dev/docs/release-notes/1.0); [InfoQ](https://infoq.com/news/2026/06/zero-version-1)
  - It supports read-only access while offline — [Zero sync docs](https://zero.rocicorp.dev/docs/sync)
  - The "Offline Writes" issue is still open (modified Oct 2026). The blocker is mutation recovery across app or schema version changes, and Replicache's solution still has to be ported — [Rocicorp bug 246605](https://bugs.rocicorp.dev/p/zero/issue/246605)
- **Triplit:**
  - The co-founder joined Supabase (2025-10-08) to work on offline-first. Supabase is not integrating Triplit, and the codebase is to be further open-sourced — [Supabase blog](https://supabase.com/blog/triplit-joins-supabase)
  - Triplit is AGPL — [dev.co listing](https://dev.co/databases/open-source/triplit)

### Inferences
- **Recommended: PowerSync (self-hosted Open Edition, now Apache 2.0) in both the Flutter app and the web reception app.** The backend upload endpoint becomes the single write gateway. It runs the same NestJS command handlers as online writes: tenant/RLS context, validation, audit log, outbox.
- **Conflict rules belong in domain logic, not generic LWW:**
  - **Queue ticket numbers:** issue them server-side when online. Offline, issue provisional per-device prefixed numbers (e.g., `R1-017`) and reconcile.
  - **Appointment overlaps:** let the PG exclusion constraint reject the second write and surface a "conflict inbox" for reception.
  - **Cash drawer:** use append-only payment events (no updates), so conflicts become sums rather than overwrites.
- **Operations:** PowerSync self-hosting adds a service (plus its own bucket storage, MongoDB or Postgres per docs; not re-verified) and requires Postgres logical replication (`wal_level=logical`).
- **Web risk:** web offline with Flutter Web is beta. If the reception UI is a TS/React web app, use PowerSync's JS web SDK (maturity not verified this session). Background knowledge: it is widely used.
- **Alternative: a clinic edge node.** A small Linux box at each clinic runs a local copy and syncs upstream. It is more robust to power and internet loss, but much heavier for 3–5 developers. Consider it only for large multi-branch tenants.
- **Electric + TanStack DB:** not suitable for offline writes without your own durable outbox, and still beta.
- **Zero:** unsuitable until offline writes ship.

### Gaps
- RxDB (premium plugins licensing), Dexie Cloud pricing and Replicache's current status (open-sourced and in maintenance per background knowledge) were not verified; the search budget was exhausted.
- PowerSync's JS/web SDK and Flutter SDK GA status as of Nov 2026, and whether Open Edition is still "beta", need checking on the docs.
- The storage requirements of a self-hosted PowerSync service were not re-verified.

---

## 5. Background jobs / outbox

### Takeaway
Use a Postgres-native queue so jobs are enqueued in the same transaction as the business write (a transactional outbox with no dual-write). pg-boss 12.x is the most active (12.38.1 on 2026-11-05) and has a dashboard. Graphile Worker 0.17 is the runner-up. Inngest self-host is possible but adds licensing ambiguity and an experimental Postgres backend. Temporal is overkill for this team.

### Cited Findings
- **pg-boss** — [pg-boss releases](https://github.com/timgit/pg-boss/releases):
  - Latest is 12.38.1 (05 Nov). It fixes a `groupConcurrency` overrun and duplicate cron sends on DST night.
  - 12.38.0 (13 Oct) requires a migration, caps list reads at 1,000 rows, and makes bulk deletes non-atomic.
  - Companion dashboard 1.13.0 and proxy 1.13.0 (with an `authorize` option) are released alongside.
- **pg-boss majors:** v11 rewrote the schema with no archive table (completed jobs are deleted after `deleteAfterSeconds`), and pg-boss 12 requires Node ≥ 22.12 — [Supabase storage PR #1198](https://github.com/supabase/storage/pull/1198)
- **Graphile Worker:** the official release notes list 0.18.0 as pending, which implies 0.17 has shipped. Breaking change: cosmiconfig is replaced by `graphile.config.ts` — [Graphile Worker releases](https://worker.graphile.org/releases)
- **Inngest:**
  - Self-host 1.0 changed the license from SSPL to "automatically Apache 2.0 after 3 years" — [Inngest 1.0 announcement](https://www.inngest.com/blog/inngest-1-0-announcing-self-hosting-support)
  - A third party says self-host is BSL, which conflicts — [Diagrid FAQ](https://www.diagrid.io/faq/alternatives-dbos-inngest/how-do-catalyst-dbos-and-inngest-support-deployment-in-air-gapped-or-vpc-locked-environments-where-externa)
  - The Postgres backend is "experimental" (Jan 2025, CLI v1.4.0) — [Inngest changelog](https://www.inngest.com/changelog/2025-01-20-postgres-self-hosting)
  - No direct support is guaranteed for self-hosted instances — [Inngest self-host docs](https://www.inngest.com/docs/platform-and-operations/self-host-inngest.md)

### Inferences
- **Recommended: pg-boss 12.** Background knowledge (unverified): pg-boss lets `send()` use an existing transaction/connection. Use it so "create appointment + enqueue WhatsApp reminder + enqueue FCM push + enqueue Centrifugo publish" commit atomically. One database also means one backup and restore story, which matters for in-Syria relocation.
- **Graphile Worker** is the runner-up: very fast, uses LISTEN/NOTIFY for low latency, and can be enqueued from SQL triggers.
- **BullMQ (Redis)** only if Redis/Valkey becomes central anyway. It loses transactional enqueue.
- **Temporal** brings heavy operations (its own cluster). Not justified for reminders, PDF and Excel generation, and webhook retries.

### Gaps
- BullMQ v5 and Temporal self-host status in 2026 were not researched (budget exhausted).
- pg-boss's transactional `send` API should be confirmed in its current docs.

---

## 6. Realtime (queue boards, TV displays, multi-device sync)

### Takeaway
Use Centrifugo OSS (Apache 2.0), a standalone Go server with channels, history and recovery, fed by the backend after commit. It scales to many tenants and screens without coupling WebSocket state to the API process. The runner-up is Socket.IO (or ws) inside NestJS with a Redis/Valkey adapter. Avoid making Postgres LISTEN/NOTIFY the fan-out bus on hot write paths.

### Cited Findings
- **Centrifugo OSS vs PRO:**
  - OSS is Apache 2.0, built on the MIT Centrifuge library — [Centrifugal FAQ](https://centrifugal.dev/components/FAQ)
  - PRO is commercial, a superset of OSS — [Centrifugo PRO install docs](https://centrifugal.dev/docs/pro/install_and_run)
  - PRO adds a push notifications API (FCM/APNs/HMS/WebPush), ClickHouse analytics, tracing, rate limiting, per-namespace engines and Redis Cluster support — [Centrifugo PRO](https://centrifugal.dev/pro)
  - Without a key, PRO runs in sandbox mode capped at 20 connections, 2 nodes and 5 API rps — [Centrifugal FAQ](https://centrifugal.dev/components/FAQ)
  - PRO v6.9.4 exists — [centrifugo-pro releases](https://github.com/centrifugal/centrifugo-pro/releases/tag/v6.9.4)
- **LISTEN/NOTIFY pitfalls:**
  - Committing a transaction that issued NOTIFY takes a global exclusive lock (to preserve commit order), so such commits serialize — [DBOS blog](https://dbos.dev/blog/postgres-listen-notify-scalability); [Recall.ai](https://recall.ai/blog/postgres-listen-notify-does-not-scale)
  - The lock affects all databases in the cluster — [pgsql-hackers docs patch](https://postgrespro.com/list/id/CAM527d_s8coiXDA4xbJRyVOcNnnjnf+ezPYpn214y3-5ixn75w@mail.gmail.com)
  - Batching NOTIFYs mitigates it — [DBOS blog](https://dbos.dev/blog/postgres-listen-notify-scalability)
  - An "out-of-order NOTIFY" proposal exists — [hackorum](https://hackorum.dev/topics/51945)
  - Sources conflict on whether core PG has already fixed the bottleneck — [Recall.ai](https://recall.ai/blog/postgres-listen-notify-does-not-scale) vs [DBOS blog](https://dbos.dev/blog/postgres-listen-notify-scalability)

### Inferences
- **Recommended pattern:**
  - Domain write, then an outbox row in the same transaction, then a pg-boss worker (or batched relay) publishes to Centrifugo's HTTP/GRPC API.
  - Channels per tenant and branch, e.g. `queue:{tenant}:{branch}` and `display:{tenant}:{screen}`, authorized with Centrifugo JWT channel tokens minted by the API.
  - Centrifugo's history/recovery lets TV displays recover missed events after Wi-Fi blips. Background knowledge; confirm in the docs.
- **Voice calls on waiting-room displays:** do these client-side (pre-recorded Arabic audio segments or on-device TTS) triggered by "call" events. No server audio streaming.
- **FCM:** send directly from the backend (firebase-admin). There is no need for Centrifugo PRO's push API.
- **Socket.IO** is simpler at a few hundred connections and keeps everything in NestJS. It is fine as the runner-up, but sticky sessions and the adapter are needed for horizontal scaling (background knowledge).
- **SSE** is adequate for one-way TV displays and works through restrictive proxies (background knowledge).

### Gaps
- Socket.IO 4.x, uWebSockets.js licensing and maintenance, and Centrifugo OSS v6 latest version/date were not verified (budget exhausted).

---

## 7. Auth / identity (multi-org membership, RBAC, MFA, device sessions, SMS-free phone verification)

### Takeaway
Better Auth (TypeScript library, in-process, Drizzle/Prisma/Kysely adapters) best fits a TS monolith:
- The phone-number plugin takes a custom `sendOTP` callback, so OTPs can go over WhatsApp (WAHA) with no SMS provider.
- The organization plugin, 2FA, admin, API-key and SSO plugins exist, and 1.5 (2026-02-28) was a large maturity release.
- The runner-up is Keycloak 26.5 for a standards-heavy, language-agnostic IdP, at the cost of a JVM service and custom SPI work for WhatsApp OTP.
- Lucia is deprecated. Zitadel is AGPL since v3.

### Cited Findings
- **Better Auth 1.5 (2026-02-28)** — [Better Auth 1.5 blog](https://better-auth.com/blog/1-5):
  - About 600 commits, 70 features and around 200 fixes.
  - New CLI, an OAuth 2.1 Provider plugin (OIDC, dynamic client registration), and production-ready SSO (SAML Single Logout).
  - API keys moved to `@better-auth/api-key` with organization-owned keys (breaking change).
  - Phone-number and two-factor updates; DB adapters split into Drizzle/Prisma/Kysely/MongoDB packages; non-destructive secret rotation.
  - Better Auth Inc. announced an "Infrastructure" hosted product with Pro and Business tiers.
- **Better Auth 1.7.0-beta.2** includes organization-plugin fixes and a scoped `listUserTeams` (beta, undated) — [releases.sh entry](https://releases.sh/release/rel_FmEJblXAiOoakHjc2z-2Y)
- **Phone-number plugin** — [Better Auth phone-number plugin docs](https://www.better-auth.com/docs/plugins/phone-number):
  - The `sendOTP` callback is user-implemented, with no SMS provider required.
  - `expiresIn` defaults to 300 s and `allowedAttempts` to 3 (then 403).
  - Phone + password sign-in via `/sign-in/phone-number`.
  - An optional `verifyOTP` can delegate checking to an external service.
- **Lucia:** v3 is deprecated and now a learning resource — [reactibot issue quoting Lucia docs](https://github.com/reactiflux/reactibot/issues/498); [tooling guide 2026](https://tooling-2ry.pages.dev/docs/categories/auth/)
- **Keycloak 26.5:**
  - 26.5.0 (2026-01-06) added organization invitation management (Admin Console plus REST), an MCP authorization server guide and OpenTelemetry log export — [Keycloak 26.5.0](https://www.keycloak.org/2026/01/keycloak-2650-released)
  - Later 26.5.x patches fixed org-related security issues: disabled organizations still resolving in login flows (#45874) and org membership enumeration (#47062) — [Keycloak 26.5.4](https://www.keycloak.org/2026/02/keycloak-2654-released)
  - 26.5.1 fixed a passkey list rendering bug — [Keycloak 26.5.1](https://www.keycloak.org/2026/01/keycloak-2651-released)
- **Zitadel:**
  - Moved from Apache 2.0 to AGPL 3.0 with v3 (2025-03-31). SDKs stay Apache, and a commercial license is offered — [Zitadel blog](https://zitadel.com/blog/apache-to-agpl); [Zitadel license FAQ](https://zitadel.com/license-faq)
  - v4.x is current (4.13.0 on 2026-03-23, per an unofficial page) — [third-party KB](https://knowledge-base-4bl.pages.dev/secrets/zitadel/)

### Inferences
- **Recommended Better Auth setup:**
  - Organization plugin: a user can belong to many clinics/tenants, with per-org roles.
  - Phone-number plugin with `sendOTP` delivered through WAHA WhatsApp. This is SMS-free; keep an SMS fallback hook for later.
  - Two-factor (TOTP) for clinic staff, and the passkey plugin for admins (passkey plugin maturity not verified this session).
  - Multi-session or device listing for "log out other devices".
  - Map Better Auth org roles onto your own permission matrix (RBAC tables plus feature entitlements), enforced in NestJS guards and RLS.
- **Main risk:** a young library company (Better Auth Inc.) with frequent breaking changes in minor releases (e.g., API-key moved in 1.5). Pin versions and wrap auth behind an internal module interface.
- **Keycloak** is the runner-up if a non-TS backend is chosen or a central IdP for multiple apps is needed. Organizations are maturing, but WhatsApp OTP needs a custom authenticator SPI (background knowledge).
- **Zitadel** is good technically, but AGPL plus a younger organizations model. **Ory** was not researched.

### Gaps
- Better Auth passkey and multi-session plugin status, security advisories, and community size in 2026 were not verified.
- Whether Auth.js is now maintained under Better Auth (reported in 2025 per background knowledge) could not be confirmed. The search returned nothing before the budget ran out.
- Ory (Kratos/Hydra) 2026 status was not researched.

---

## 8. Search (Arabic patient and record search)

### Takeaway
Use PostgreSQL first. Postgres's Arabic Snowball stemmer is too aggressive for names, and `unaccent` is Latin-only. Patient search should therefore use application-side Arabic normalization (strip tashkeel, unify alef/ya/ta-marbuta) into generated or normalized columns, combined with pg_trgm for fuzzy name and phone matching. Add Meilisearch CE (MIT) only if typo-tolerant global search becomes a product need.

### Cited Findings
- **Postgres Arabic stemming:**
  - Postgres ships an Arabic Snowball stemmer with normalization and prefix/suffix stripping — [stemmer symbol doc](https://ryogrid.github.io/create_pg_super_document/a/arabic_UTF_8_stem.html)
  - One team rejected it as too aggressive for product search, used the `simple` dictionary, and noted `unaccent` is Latin-only — [961tech RFC-0003](https://961tech.pages.dev/rfc/0003-search-backend/)
  - That team normalizes in app code (strip tashkeel, unify alef forms, ya and ta marbuta) at both index and query time — [961tech ADR-0008](https://961tech.pages.dev/adr/0008-search-postgres-fts/)
  - An older PG `unaccent.rules` file can be missing characters — [postgresql-tsearch-utils](https://github.com/codebicycle/postgresql-tsearch-utils)
- **pg_trgm on Arabic:** sometimes gives poor results on Arabic text — [wassimbj blog](https://wassimbj.github.io/blog/full-text-search-in-postgres)
- **Meilisearch:**
  - Community Edition is MIT. Enterprise Edition is BUSL-1.1 (since v1.28, separate binaries and Docker image) — [Meilisearch v1.28 changelog](https://www.meilisearch.com/docs/changelog/v1.28.md)
  - Sharding is the only EE-exclusive feature, and production EE needs sales contact — [Meilisearch EE docs](https://meilisearch.com/docs/learn/self_hosted/enterprise_edition)
  - Free EE licenses are available for indie and non-profit projects — [Meilisearch EE announcement](https://kubecon.meilisearch.com/blog/enterprise-license)
  - Meilisearch claims optimized Arabic tokenization — [Meilisearch vs Typesense](https://meilisearch.com/docs/resources/comparisons/typesense)

### Inferences
- **Recommended Postgres setup:**
  - Columns `name_norm` (normalized Arabic plus Latin transliteration), `phone_norm` (E.164) and `file_no`.
  - GIN trigram index on `name_norm`, B-tree on `phone_norm`.
  - `simple`-config tsvector for clinical notes, if note search is needed.
  - This keeps search inside RLS (tenant isolation for free) and works offline in PowerSync's SQLite with the same normalization function shared via a TS package.
- **Meilisearch CE** is the runner-up. It requires syncing documents and separate tenant filtering (tenant tokens), which duplicates RLS. That is a real security surface for a healthcare product.

### Gaps
- Typesense and OpenSearch Arabic analyzers and 2026 versions were not researched (budget exhausted).
- Meilisearch's Arabic normalization details (alef/hamza variants) were not confirmed.

---

## 9. Object storage (S3-compatible, self-hostable; DICOM, attachments, PDFs)

### Takeaway
MinIO Community Edition is effectively dead upstream:
- Console stripped in May 2025.
- Binaries and Docker images stopped in October 2025.
- Maintenance mode from December 2025.
- Repository archived in February 2026 and re-archived on April 25, 2026.

For a small team, use Garage (AGPLv3, simple, geo-distributed, production since 2020) or SeaweedFS (Apache 2.0, most mature and feature-rich, more moving parts). RustFS (Apache 2.0) is the MinIO drop-in, but its GA status is unconfirmed. Code against the S3 API only, so the backend can move to a managed S3 or an in-Syria cluster.

### Cited Findings
- **MinIO CE timeline:**
  - Admin console removed from CE (May 2025); binary and Docker distribution stopped (Oct 2025); README maintenance-mode commit (2025-12-03); repo briefly unarchived, then locked again on 2026-04-25 — [It's FOSS](https://itsfoss.com/news/minio-moves-away-from-open-source/)
  - Repo archived on 2026-02-12 — [lavx news](https://news.lavx.hu/article/minio-officially-archived-community-fork-resurrects-popular-object-storage-solution)
  - The code remains AGPLv3, but the practical path is source-only self-builds — [Glukhov](https://glukhov.org/data-infrastructure/object-storage/minio-dead/)
  - The community fork pgsty/minio ("SILO") restored the console. Its author lists unpatched upstream CVEs, including CVE-2026-33322 (9.8). This is the fork author's claim and is unverified — [Vonng blog](https://blog.vonng.com/en/db/minio-resurrect/)
- **Alternatives compared (Elestio, 2026-04-01)** — [Elestio comparison](https://blog.elest.io/rustfs-vs-seaweedfs-vs-garage-which-minio-alternative-should-you-pick/):

| Option | License | Status | Notes |
|---|---|---|---|
| SeaweedFS | Apache 2.0 | Production-ready since 2015 | Many small files, erasure coding, FUSE/WebDAV |
| Garage | AGPLv3 | Production since 2020 | Runs on cheap VPS; replication factor must match nodes; S3 compatibility "isn't always 100%" |
| RustFS | Apache 2.0 | Alpha; its docs said "do NOT use in production" | Easiest MinIO migration |

- **SeaweedFS architecture:** master, volume servers, filer and S3 gateway — [Elestio MinIO-alternatives guide](https://blog.elest.io/minio-is-in-maintenance-mode-your-guide-to-s3-compatible-storage-alternatives/)
- **RustFS GA claim:** one vendor-adjacent source claims 1.0.0 GA on 2026-09-16, with some features still in preview. Single source, unconfirmed — [Hostzero](https://hostzero.com/articles/rustfs-vs-s3-in-eu-minio-is-dead-heres-your-escape-route)
- **Garage:**
  - AGPLv3, built by Deuxfleurs — [Garage repo mirror](https://github.com/deuxfleurs-org/garage)
  - Crates show 2.1.0 (Sep 2025) — [lib.rs](https://lib.rs/crates/garage)
  - An April 2026 comparison cites v2.3.0 (search summary)
  - Open edX's Tutor replaced MinIO with Garage — [Open edX discuss](https://discuss.openedx.org/t/replacing-minio-in-tutor-minio-why-we-chose-garage-and-what-comes-next/18868)
- **Ceph RGW:** the mature enterprise option, but it needs significant operational expertise — [Glukhov](https://glukhov.org/data-infrastructure/object-storage/minio-dead/)

### Inferences
- **Recommended: Garage** for self-hosted, multi-site deployments (e.g., EU primary plus a Turkish or in-Syria replica). Run it unmodified as a separate service. Commonly understood, not legal advice: AGPL obligations attach to modifying or distributing Garage itself, not to your app calling it over S3.
- **SeaweedFS** is the runner-up if you need richer S3 features (versioning or object-lock style protections for medical images) or very high small-object counts.
- **Before committing, verify** that the DICOM stack (Orthanc's S3 object-storage plugin), presigned URLs, multipart uploads and lifecycle rules work against the chosen store.
- Do not start new deployments on MinIO CE.

### Gaps
- Hetzner Object Storage, Cloudflare R2 and Backblaze B2 availability and pricing for a Turkish-company payer, and any restrictions on Syria-related use, were not researched (budget exhausted).
- Garage versioning and object-lock support were not confirmed.
- Orthanc S3 plugin compatibility with Garage or SeaweedFS was not verified.

---

## 10. Cache / ephemeral queue: Redis vs Valkey

### Takeaway
Use Valkey (BSD-3, Linux Foundation fork of Redis 7.2.4; v9 adds atomic slot migration and per-field TTLs). It avoids all licensing questions. Redis 8 under AGPLv3 is acceptable as the runner-up, but brings no needed benefit here.

### Cited Findings
- **Redis 8 licensing:** offered under RSALv2, SSPLv1 or AGPLv3 (user's choice) — [Redis blog](https://redis.io/blog/what-is-valkey/)
  - AGPLv3 was added with Redis 8.0 / May 2025 — [OneUptime](https://oneuptime.com/blog/post/2026-03-31-redis-redis-vs-valkey-understanding-the-fork/view); [ComputingForGeeks](https://computingforgeeks.com/?p=170263)
  - One page's "BSLLv1 + AGPL" claim conflicts with these and looks unreliable — [tech-insider](https://tech-insider.org/valkey-vs-redis-2026/)
- **Valkey:**
  - BSD-3-Clause fork of Redis 7.2.4 — [OneUptime](https://oneuptime.com/blog/post/2026-03-31-redis-redis-vs-valkey-understanding-the-fork/view)
  - Valkey 9 added atomic slot migration and per-field TTLs; Redis 8 bundles search, JSON and vector in core — [ComputingForGeeks](https://computingforgeeks.com/?p=170263)
  - Benchmarks are disputed — [Cloudmagazin](https://www.cloudmagazin.com/en/2026/04/10/valkey-9-redis-fork-cloud-cache-landscape/)
- **Redis usage:** 28% of respondents (Stack Overflow 2025) — [SO 2025](https://survey.stackoverflow.co/2025/technology/)

### Inferences
- With pg-boss handling jobs, Valkey's role shrinks to: rate limiting, Better Auth secondary storage/sessions cache, the Centrifugo engine (multi-node), and short-lived caches such as exchange rates and tenant settings. A single small Valkey instance suffices initially.

### Gaps
- The latest Valkey 9.x version and date, and client-library compatibility (ioredis or node-redis vs Valkey's GLIDE), were not verified.

---

## 11. PDF generation with Arabic RTL and shaping

### Takeaway
Use HTML/CSS through headless Chromium (Playwright in a worker, or the Gotenberg container), with embedded Arabic fonts. Chromium's HarfBuzz shaping and bidi handle Arabic correctly, and templates share the web team's skills. pdfmake/PDFKit-style writers depend on fonts and have a history of RTL problems. Typst (0.15.1) supports `dir: rtl` and Arabic fonts and is a fast, deterministic runner-up worth a spike.

### Cited Findings
- **Chromium/Puppeteer** shape Arabic correctly, while many lightweight PDF writers do not (weak/aggregator source) — [Gurubase Q&A](https://gurubase.io/g/nodejs/fast-alternative-puppeteer-pdf-generation-arabic-support)
- **pdfmake:**
  - Arabic letters failing to show requires embedding Arabic fonts — [Ionic forum](https://forum.ionicframework.com/t/is-there-any-way-to-generate-pdf-with-arabic-text-using-pdfmake-library/126635)
  - An open GitHub issue on RTL support was noted (older post) — [DataTables forum](https://datatables.net/forums/discussion/comment/173610)
- **Font-shaping case study:** Plane's PDF export found that Inter has no Arabic code points or OpenType GSUB tables, and fixed it by registering Vazirmatn — [Plane PR #9187](https://github.com/makeplane/plane/pull/9187)
- **Typst:**
  - Docs (v0.15.1): `dir` defaults to `auto` (inferred from `lang`); for Arabic or Hebrew you should set lang or dir; the bidi algorithm places punctuation and inline objects; RTL bug reports are requested; with no fallback glyphs, text renders as tofu without a warning — [Typst text docs](https://typst.app/docs/reference/text/text/)
  - Community packages: `auto-bidi` (per-paragraph direction detection) — [Typst Universe auto-bidi](https://typst.app/universe/package/auto-bidi); `araby-book` (Amiri / Noto Naskh) — [Typst Universe araby-book](https://typst.app/universe/package/araby-book/)
  - A Jan-2024 snapshot table lists Typst without full UBA support. This is likely outdated, since current docs reference bidi handling — [bidi table snapshot](https://wikipedia.jakami.de/content/archlinux_en_all_maxi_2026-04/Bidi)

### Inferences
- **Recommended: a dedicated "pdf-renderer" worker.** Use Playwright Chromium or Gotenberg 8, driven by pg-boss jobs, with HTML templates (`dir="rtl"`, `lang="ar"`) and self-hosted fonts (Noto Naskh Arabic, Amiri, Cairo or Vazirmatn). Store output in S3. Cache-bust per template version, which matches the versioned clinical templates.
- **Gotenberg:** wraps Chromium (and LibreOffice). It is inferred to shape Arabic identically when fonts are installed, but no source confirmed it this session.
- **Typst:** the runner-up for high-volume receipts and invoices, since it uses far less memory than Chromium. Validate Arabic numerals, mixed Arabic/English drug names, and tables in a spike first.
- **Avoid pdfmake/PDFKit** for Arabic-heavy medical documents.

### Gaps
- WeasyPrint Arabic support and the latest Gotenberg version were not researched (budget exhausted).

---

## 12. Excel export

### Takeaway
Both mainstream JS options carry maintenance risk:
- SheetJS CE has stopped publishing to npm; the npm `xlsx` package is stuck on vulnerable versions, and fixes ship only from cdn.sheetjs.com.
- ExcelJS's latest release is still v4.4.0, with a large open-issue and PR backlog.

Use ExcelJS (styling and streaming writer) behind an internal interface. SheetJS CE pinned from the vendor CDN tarball is the runner-up.

### Cited Findings
- **SheetJS on npm:**
  - The npm `xlsx` package is no longer maintained there, so no non-vulnerable version is installable from npm — [GitLab advisory CVE-2023-30533](https://advisories.gitlab.com/npm/xlsx/CVE-2023-30533/)
  - CVE-2023-30533 (prototype pollution) affects ≤ 0.19.2; CVE-2024-22363 (ReDoS) affects < 0.20.2; fixed builds are on cdn.sheetjs.com — [GitLab advisory CVE-2024-22363](https://advisories.gitlab.com/pkg/npm/xlsx/CVE-2024-22363/)
  - The documented workaround is an npm `overrides` entry pointing at the CDN tarball; maintainers suggest vendoring or a proxy registry — [SheetJS issue #2961](https://git.sheetjs.com/sheetjs/sheetjs/issues/2961); [SheetJS issue #3112](https://git.sheetjs.com/sheetjs/sheetjs/issues/3112)
  - Maintainers claim npm (Microsoft) blocked their releases under an open license. This is the maintainers' account only — [SheetJS issue #2961](https://git.sheetjs.com/sheetjs/sheetjs/issues/2961)
- **ExcelJS:** the releases page shows v4.4.0 (dated "19 Oct", year not shown) as the latest, with 670 open issues and 157 open PRs — [ExcelJS releases](https://github.com/exceljs/exceljs/releases)

### Inferences
- **ExcelJS** supports styled cells, RTL worksheet views and streaming writes for large reports (background knowledge). Wrap it in a `ReportWriter` interface so it can be swapped.
- **Alternative:** generate CSV for raw exports, and use Excel only for formatted reports.
- **Do not `npm install xlsx`** from the npm registry.

### Gaps
- The year of ExcelJS v4.4.0 was not shown on the page (background knowledge: Oct 2023, i.e., no release in about 3 years). This needs confirmation, along with whether an active fork exists.
- The SheetJS CE license (Apache-2.0 per background knowledge) was not confirmed this session.

---

## 13. Feature flags / per-tenant entitlements

### Takeaway
Entitlements (plan, then features and limits, plus per-tenant overrides) are business and billing data. They belong in your own Postgres tables, enforced in API guards, RLS and the offline client. Release flags can use OpenFeature with a simple in-house provider. Self-hosted Flagsmith (BSD-3) is the runner-up if the team later wants a flag UI, gradual rollouts and experiments.

### Cited Findings
- **Licenses:**
  - Unleash is AGPL-3.0 and free to self-host — [DeployHQ comparison](https://www.deployhq.com/blog/feature-flag-tools-compared)
  - Flagsmith is mostly BSD-3-Clause — [DeployHQ comparison](https://www.deployhq.com/blog/feature-flag-tools-compared)
  - GrowthBook is open-core (MIT core plus commercial directories) — [OpenAlternative](https://openalternative.co/compare/flagsmith/vs/growthbook)
  - A competitor blog claims GrowthBook moved to the Fair Core License, which conflicts with the above — [FeatBit guide](https://www.featbit.co/blogs/open-source-feature-flag-tools-2027)
- **Governance features** (approvals, audit) are paid in Unleash, Flagsmith and GrowthBook — [FeatBit guide](https://www.featbit.co/blogs/open-source-feature-flag-tools-2027)
- **OpenFeature:** all four (LaunchDarkly, Unleash, Flagsmith, GrowthBook) publish providers, so switching tools means changing the provider, not rewriting flag checks — [DeployHQ comparison](https://www.deployhq.com/blog/feature-flag-tools-compared)

### Inferences
- **Suggested schema:**
  - `plans`, `plan_features(feature_key, limit_int, enabled)`
  - `tenant_feature_overrides`
  - `tenant_settings` (JSONB, schema-validated)
- Resolve the merged entitlements once per request and cache them in Valkey. Sync them to clients via PowerSync so offline UIs gate correctly.
- A super-admin panel edits these tables, with audit logging.

### Gaps
- Current GrowthBook license and OpenFeature Node/Dart SDK maturity were not verified.

---

## 14. Deployment & operations (orchestration, PaaS, hosting/residency, backups, observability, secrets, CI/CD, scanning)

### Takeaway
Use Docker Compose on a few VMs, deployed with Kamal 2 (MIT, SSH-based, no dashboard) or Coolify (Apache-2.0, free self-host). Skip Kubernetes/k3s until there are multiple regions or many services.

Choose providers with portability in mind:
- The Caesar Act was repealed (FY2026 NDAA, signed in December 2025), but some barriers remain.
- Hetzner's terms require compliance with US export rules.
- Syria's Law 12/2024 restricts storing data abroad.

Use GlitchTip (MIT, light) over self-hosted Sentry (FSL, 16–32 GB RAM). Use Infisical (MIT core) over OpenBao for secrets.

### Cited Findings
- **Container usage:** Docker 71.1% and Kubernetes 28.5% of respondents — [SO 2025](https://survey.stackoverflow.co/2025/technology/)
- **Coolify:**
  - Apache-2.0; self-hosted is free with the same features as Coolify Cloud — [Coolify vs Dokploy (vendor page)](https://coolify.io/compare/coolify-vs-dokploy)
  - A January 2026 CVE was fixed in v4.0.0 (2026-04-27); keep the dashboard off the public internet — [Cloudzy (JA)](https://cloudzy.com/ja/blog/coolify-vs-dokploy/)
  - Reported in third-party comparisons: Coolify stops all containers before a Compose restart (no rolling update), and idles at roughly 0.5–1.2 GB RAM — [GetDeploying](https://getdeploying.com/guides/coolify-vs-dokploy); [wz-it comparison](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
- **Dokploy:**
  - Apache-2.0, plus proprietary parts under "DSAL". One comparison reads DSAL as requiring a commercial agreement for production use — [wz-it comparison](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
  - Custom roles, SSO, SCIM and audit logs are Enterprise features — [Coolify vs Dokploy](https://coolify.io/compare/coolify-vs-dokploy)
- **Kamal:** MIT, SSH-based, no orchestration layer and no dashboard; suits one or two apps — [DEV self-hosted PaaS comparison 2026](https://dev.to/_6638a39c349d7e9c85ee20/self-hosted-paas-comparison-2026-coolify-vs-dokploy-vs-caprover-vs-kamal-vs-dokku-m6e); [Bitdoze](https://www.bitdoze.com/md/es/coolify-vs-dokploy-vs-kamal-2.md)
- **Sanctions:**
  - The Caesar Act was repealed via the FY2026 NDAA. The Senate passed it on 2025-12-17, and it was signed on 2025-12-18/19 — [The National](https://www.thenationalnews.com/news/mena/2025/12/20/syria-welcomes-repeal-of-sweeping-us-sanctions); [Enab Baladi](https://english.enabbaladi.net/archives/2025/12/trump-signs-repeal-of-caesar-sanctions-law/amp/); [The New Arab](https://www.newarab.com/news/us-senate-repeals-caesar-act-amid-intensified-fight-syria)
  - Barriers to trade remain, and the State Sponsor of Terrorism designation is under review — [Just Security](https://www.justsecurity.org/125619/removing-syria-state-sponsor-terrorism-designation/)
- **Hetzner terms (AGB §4.5):** customers must comply with export and import controls, "insbesondere der US-Vorschriften". No Syria-specific clause was found — [Hetzner AGB](https://www.hetzner.com/de/rechtliches/agb?country=de)
- **Sentry self-hosted vs GlitchTip:**
  - Sentry self-hosted officially needs 4 cores, 16 GB RAM plus 16 GB swap and 20 GB disk (32 GB RAM recommended), with 40+ containers including Kafka and ClickHouse; its license is FSL (converts to Apache 2.0 after 2 years) — [selfhosting.sh GlitchTip vs Sentry](https://dev.to/selfhostingsh/glitchtip-vs-sentry-206o); [Blendbyte](https://www.blendbyte.com/blog/sentry-self-hosting-71-containers-tindra-one)
  - GlitchTip is MIT, needs a minimum of 1 vCPU and 512 MB (2 GB recommended), and is Sentry-SDK compatible. It has no session replay and only basic performance monitoring — [selfhosting.sh](https://dev.to/selfhostingsh/glitchtip-vs-sentry-206o); [Railway GlitchTip template](https://railway.com/deploy/glitchtip-railway)
- **Secrets:**
  - Infisical's core is MIT. Self-hosting uses Postgres and Redis. SAML/SCIM, custom RBAC and multi-region are enterprise features — [Infisical blog (vendor)](https://infisical.com/blog/hashicorp-vault-alternatives)
  - OpenBao is the Linux Foundation fork of Vault 1.14 (MPL). It has no enterprise gating, but Vault-level operations (unseal, Raft) and a CLI-first interface — [Infisical blog (vendor)](https://infisical.com/blog/hashicorp-vault-alternatives); [Hackceleration](https://hackceleration.com/labs/switch/hashicorp-vault)
- **Self-hosting caveat:** with no vendor support, someone must own operations. Configure external logging so logs survive a server loss — [wz-it comparison](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/); [DEV comparison](https://dev.to/_6638a39c349d7e9c85ee20/self-hosted-paas-comparison-2026-coolify-vs-dokploy-vs-caprover-vs-kamal-vs-dokku-m6e)

### Inferences
- **Topology (initial):**
  - VM1: API + workers (NestJS, pg-boss workers, PDF renderer).
  - VM2: Postgres 18 primary + pgBackRest. Optionally a streaming replica on VM3 that also runs Centrifugo, Valkey, PowerSync and Garage nodes.
  - Garage nodes spread over 3 VMs.
  - Deploy everything with Kamal (or Coolify if the team wants a UI). Compose files stay portable to an in-Syria data centre.
- **Hosting:** EU (Hetzner, OVH) is cheapest and most reliable. A Turkish data centre gives lower latency to Aleppo/Azaz and payment ease for a Turkish company. Both may need Article 15 authorization for patient data. Keep the design ready for an in-Syria primary with an offsite encrypted backup (subject to legal advice).
- **Backups:** pgBackRest (or WAL-G) to S3 storage at a different provider, with PITR and quarterly restore drills. Back up Garage and Orthanc storage separately.
- **Observability:** OpenTelemetry SDK in NestJS feeding Grafana + Prometheus/Mimir + Loki + Tempo (or a lighter option such as SigNoz), plus GlitchTip for errors.
- **CI/CD and scanning:** GitHub Actions (GitHub access from Syria still needs confirmation, but the Turkish company owns the accounts). Security scanning with Trivy (images), Dependabot/Renovate, gitleaks, and Semgrep or CodeQL. These recommendations are from background knowledge; see Gaps.

### Gaps
- Not researched (search budget exhausted):
  - Turkish providers (Turkticaret, Natro and others): pricing, PG availability, and KVKK health-data rules.
  - Gulf regions.
  - Contabo/OVH terms on Syria.
  - GitHub, Cloudflare and FCM access from Syria after the 2025 sanctions changes.
- pgBackRest, WAL-G and Barman 2026 maintenance status were not verified. Background knowledge: all active, but this must be confirmed before choosing.
- Grafana stack licensing (AGPL for Grafana, Loki and Mimir), SigNoz and OpenTelemetry Node SDK status were not verified this session.
- k3s vs Compose evidence specific to 2026 was not gathered beyond PaaS comparisons.

---

## 15. API style, validation, money and date/time

### Takeaway
- **API style:** REST + OpenAPI 3.1 generated from NestJS. It is the only option that serves both Flutter (Dart codegen such as florval or openapi-generator dart-dio) and TS clients. tRPC is TS-only, and GraphQL adds complexity without benefit here.
- **Validation:** NestJS 12 moved config validation to Standard Schema, which favours Zod 4 or Valibot schemas shared across packages.
- **Money:** keep it as integer minor units or NUMERIC in Postgres, using a decimal library in TS.
- **Dates:** Temporal is shipping in Firefox and Chrome but is not yet universal (Safari), so use a polyfill or date-fns/Luxon for now.

### Cited Findings
- **NestJS 12 and Standard Schema:** @nestjs/config validation moved to Standard Schema (Joi needs v18+ under `validationOptions.libraryOptions`) — [NestJS v12.0.0 release](https://github.com/nestjs/nest/releases/tag/v12.0.0)
  - A DEV deep-dive describes "Standard Schema route validation" in NestJS 12 — [DEV](https://dev.to/x4nent/nestjs-12-deep-dive-full-esm-migration-standard-schema-route-validation-and-the-4fe0)
- **Dart OpenAPI generators:**
  - florval 0.3.13 is inspired by Orval and generates a Dio client, Riverpod providers, freezed models and status-code unions — [florval docs](https://pub.dev/documentation/florval/latest/); [florval changelog](https://pub.dev/packages/florval/changelog)
  - openapi_flutter_gen is a standalone CLI with a self-reported comparison against swagger_parser, openapi_generator and others (June 2026) — [openapi_flutter_gen](https://pub.dev/packages/openapi_flutter_gen/versions/0.2.10)
  - dart_openapi_generator is a build_runner builder — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fangeloavv%2Fdart_openapi_generator)
- **Temporal API:**
  - Shipped in Firefox (May 2025) and Chrome 144 (Jan 2026) — [InfoQ](https://www.infoq.com/news/2026/02/chrome-temporal-date-api); [web.dev Jan 2026](https://web.dev/blog/web-platform-01-2026)
  - Safari was behind a flag or in Technical Preview in early 2026 (sources conflict) — [web.dev](https://web.dev/blog/web-platform-01-2026); [Substack](https://mspk.substack.com/p/javascript-finally-fixed-dates-and)
  - Still Stage 3 per InfoQ (Feb 2026) — [InfoQ](https://www.infoq.com/news/2026/02/chrome-temporal-date-api)
  - A Korean digest claims Baseline status in March 2026, but its version numbers are inconsistent — [configdeck digest](https://configdeck.pages.dev/ko/article/webdev/2026-04-14-webdev-march-2026-baseline-monthly-digest)

### Inferences
- **Money and multi-currency cash:**
  - Store `amount_minor BIGINT` plus `currency CHAR(3)`. SYP has large nominal values, so avoid JS `number` for sums; use bigint or a decimal library.
  - Store exchange rates as `NUMERIC(20,8)` with `effective_at`, and freeze the rate on each payment row.
  - Make cash drawers append-only ledgers (open, payments, withdrawals, close, variance).
  - Installments are schedule rows linked to invoices.
  - dinero.js v2 (multi-currency, bigint calculator) or decimal.js/big.js are candidates; not verified this session.
- **Dates:** use `timestamptz` in Postgres, with the IANA zone stored per branch (Syria/Turkey time-zone policy changes are a real risk). In TS, use date-fns-tz or Luxon now; adopt Temporal (polyfill) once Node and Safari support is confirmed.
- **Codegen:** OpenAPI from NestJS (`@nestjs/swagger` or Zod-to-OpenAPI). For TS, hey-api/openapi-ts or Orval (not verified this session). For Dart, openapi-generator `dart-dio` (mainstream, background knowledge) or florval if using Riverpod.

### Gaps
- Zod 4, Valibot and TypeBox 2026 versions; dinero.js v2 stability; and hey-api/Orval status were not researched (budget exhausted).
- Temporal support in the Node.js LTS line (V8 version) was not verified.

---

## 16. Monorepo tooling

### Takeaway
Use pnpm workspaces + Turborepo for a 3–5 developer team with under ~15 TS packages (api, web-clinic, web-admin, public-booking, shared contracts/normalizers). Nx is the runner-up if module-boundary enforcement and generators become important. The Flutter app lives in the same repo but is managed with Dart tooling (melos/pub workspaces); this part is background knowledge, unverified.

### Cited Findings
- Turborepo suits repos with under 15 packages and small teams already on pnpm/yarn workspaces. Nx suits multiple teams, enforced architectural boundaries and graph-aware affected CI — [PkgPulse Turborepo vs Nx 2026](https://www.pkgpulse.com/guides/turborepo-vs-nx-monorepo-2026); [Digital Applied decision matrix (June 2026)](https://www.digitalapplied.com/blog/monorepo-strategy-2026-turborepo-nx-decision-matrix)
- pnpm is the most common choice for new monorepos in 2026, and neither tool replaces the package manager — [CoderCops](https://blog.codercops.com/blog/monorepo-tooling-turborepo-nx-pnpm-2026)
- Download figures (Nx ~36M monthly; Turborepo ~3.8M weekly) come from a vendor-adjacent source and are unverified — [Digital Applied](https://www.digitalapplied.com/blog/monorepo-strategy-2026-turborepo-nx-decision-matrix)

### Inferences
- NestJS has first-class Nx plugins. Even so, Turborepo's minimal config is easier for AI assistants and newcomers. Enforce module boundaries inside the NestJS monolith with ESLint rules (`eslint-plugin-boundaries`) instead.

### Gaps
- Turborepo 2.x and Nx 2026 version details were not verified.

---

## 17. Synthesis — recommended stack per layer

### Takeaway

| Layer | Recommendation | Runner-up | Why |
|---|---|---|---|
| Language / framework | TypeScript + NestJS 12.x (Fastify adapter or Express 5), modular monolith | .NET 10 LTS + ASP.NET Core (ABP open-source only; SaaS/Identity Pro are commercial) | Largest talent and AI-training pool (TS 48.8% of professionals, Node 48.7%), shared types with the web, NestJS modules/DI fit a modular monolith; .NET is excellent but splits the team across two languages, and ABP's tenancy features are paid |
| Database | PostgreSQL 18 (upgrade to 19 after GA), self-hosted | PG 19 once GA plus a few patch releases | uuidv7, AIO, RLS, exclusion constraints (no double-booking), JSONB; fully portable for Syria Law 12/2024 Art. 15 residency |
| ORM / SQL | Drizzle (pin; 1.0 RC) + `withTenant()` transaction wrapper using `set_config(...,true)`; non-owner role + FORCE RLS | Prisma 7 (Prisma 8 native `@@rls` when GA); Kysely for complex SQL | Explicit `tx` handle makes per-transaction RLS context trivial; RLS policies in the schema; Prisma's v7 RLS path conflicts with `$transaction` |
| Multi-tenancy model | Shared schema + `tenant_id` + Postgres RLS (+ branch_id scoping) | Schema-per-tenant for very large tenants | Simplest operations for many small clinics; RLS also protects reporting and search |
| Offline sync | PowerSync self-hosted Open Edition (Apache 2.0 since 2026-11-03) + backend upload handler with domain conflict rules | Custom outbox (SQLite/IndexedDB command log + idempotency keys) | Only mature option with offline writes on Flutter + web against Postgres; Electric is read-only and Zero lacks offline writes |
| Jobs / outbox | pg-boss 12.x (transactional enqueue) | Graphile Worker 0.17 | Same DB, same backup, atomic with business writes; active (12.38.1 on 2026-11-05) with a dashboard |
| Realtime | Centrifugo OSS v6 (Apache 2.0), per-tenant/branch channels, fed from outbox | Socket.IO in NestJS + Valkey adapter (or SSE for TV displays) | Offloads WebSocket fan-out and reconnect recovery; avoids the LISTEN/NOTIFY global-commit-lock bottleneck |
| Auth / identity | Better Auth 1.5+ (organization, phone-number with WhatsApp `sendOTP`, 2FA TOTP, passkey, multi-session, admin) | Keycloak 26.5 | In-process TS, Drizzle adapter, SMS-free OTP via WAHA; Keycloak is heavier and needs custom SPI for WhatsApp OTP |
| Search | Postgres: app-side Arabic normalization + pg_trgm + `simple` FTS | Meilisearch CE (MIT) | Stays inside RLS and works offline with the same normalizer; the Arabic Snowball stemmer is too aggressive and `unaccent` is Latin-only |
| Object storage | Garage (AGPLv3, unmodified, separate service) via S3 API | SeaweedFS (Apache 2.0) | MinIO CE archived; Garage is simple and geo-distributed; SeaweedFS is more mature and feature-rich but has more moving parts |
| Cache / ephemeral | Valkey 9 (BSD-3) | Redis 8 (AGPLv3 option) | Clean license; rate limits, sessions cache, Centrifugo engine |
| PDF (Arabic) | HTML → PDF via headless Chromium (Playwright worker or Gotenberg) + embedded Arabic fonts | Typst 0.15 (spike Arabic first) | Correct HarfBuzz shaping and bidi; web-skill templates; avoid pdfmake/PDFKit for Arabic |
| Excel | ExcelJS behind a `ReportWriter` interface (streaming) | SheetJS CE pinned from cdn.sheetjs.com tarball | npm `xlsx` is stale with CVEs; ExcelJS has the better styling API but slow maintenance |
| Entitlements / flags | In-house tables (plans → features/limits + tenant overrides), OpenFeature-style interface | Flagsmith self-hosted (BSD-3) | Entitlements are billing data that must work offline and in RLS; a flag SaaS is unnecessary |
| API style | REST + OpenAPI 3.1 → Dart (openapi-generator dart-dio or florval) and TS clients | GraphQL (no) / tRPC (TS-only, no) | One contract for Flutter + web + public booking; codegen keeps clients typed |
| Validation | Zod 4 (Standard Schema), shared package | Valibot | NestJS 12 Standard Schema support; same schemas on client and server |
| Money / dates | BIGINT minor units + NUMERIC FX rates; decimal.js/dinero.js v2; `timestamptz` + per-branch IANA zone; date-fns-tz/Luxon now, Temporal later | Temporal polyfill | SYP magnitudes; frozen FX per payment; Temporal not yet in Safari stable |
| Deployment | Docker Compose on 2–4 VMs via Kamal 2 (MIT) | Coolify v4 (Apache-2.0; keep dashboard private) | Small team, no Kubernetes overhead; portable to an in-Syria DC |
| Hosting | EU (Hetzner/OVH) or Turkish DC now, architected for an in-Syria primary later | Turkish DC primary + EU backup | Cost, latency and payment via the Turkish company; Law 12/2024 Art. 15 may require local hosting or authorization |
| Backups | pgBackRest (PITR) to off-provider S3 + restore drills | WAL-G | Mature PG PITR; status not re-verified this session |
| Observability | OpenTelemetry → Grafana/Prometheus/Loki/Tempo + GlitchTip (MIT) | Self-hosted Sentry (FSL; 16–32 GB RAM) | GlitchTip is light and Sentry-SDK compatible |
| Secrets | Infisical self-hosted (MIT core) | OpenBao | Postgres-based, UI for devs; OpenBao has Vault-level operational burden |
| CI/CD and scanning | GitHub Actions + Trivy + Renovate/Dependabot + gitleaks + Semgrep/CodeQL | GitLab CI self-hosted | Mainstream and AI-assistant friendly; unverified this session |
| Monorepo | pnpm workspaces + Turborepo | Nx | Fewer than 15 packages and a small team; minimal config |

### Inferences
- **Biggest architectural risks to resolve with spikes before committing:**
  1. PowerSync self-hosted, with domain conflict rules for the queue, appointments and cash drawer, under real network loss. Test both the Flutter Android and the web reception client.
  2. Drizzle + RLS wrapper + pooler (PgBouncer in transaction mode). Write tests proving tenant isolation, including that the table owner and superuser are never used by the app.
  3. Arabic PDF output (Chromium vs Typst) and the Arabic name-search normalizer.
  4. Garage + Orthanc S3 plugin + OHIF presigned access.
  5. A legal opinion on Law 12/2024 Art. 15 for EU or Turkish hosting of patient data.
- **Why these stacks lost overall:**
  - .NET/ABP is strong on typing, but its key multi-tenancy UI and features are commercial and it would add a second language next to the TS web front end.
  - Laravel + tenancy v4 has unclear v4/Laravel 13 status and weaker typing for AI-heavy work.

### Gaps
- See the per-layer Gaps above. The most material unverified items are:
  - Turkish and Gulf hosting options.
  - GitHub, FCM and Cloudflare access from Syria in late 2026.
  - Better Auth passkey and organization maturity.
  - Status of PowerSync Open Edition and its web SDK.
  - ExcelJS release year.
  - Backup tooling status.
  - Regional hiring data.
