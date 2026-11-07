# Base UI design system (web) + Flutter patient app: expert assessment and implementation approach

Context: multi-tenant healthcare SaaS for Syria, Arabic RTL first. Web UI = custom design system on Base UI (no shadcn/ui). Patient mobile app = Flutter, "professional and creative".
Research date: 2026-11-08. Method: web research only (official docs, release pages, pub.dev/npm/GitHub pages, plus labelled secondary sources). No local files were read.

Legend
- **[F]** = fact, with source id `[Sxx]` (sources at the end) and the date the fact refers to.
- **[I]** = my inference / professional judgement, not stated by a source.
- **[U]** = reported by a secondary or low-authority source, or conflicting; verify before relying on it.

---

## 0. Executive summary

**Decision A (Base UI custom design system): sound, with caveats.**
- [F] Base UI is stable: v1.0.0 shipped 2025-12-11; latest is v1.9.0 (2026-10-09). Roughly monthly minor releases. MIT license, `mui` GitHub org, "from the creators of Radix, Floating UI and Material UI"; MUI says Base UI is "where we are concentrating our foundational work going forward" (2026-01-01). [S1][S3][S6][S7]
- [F] 37 components + 4 utilities (incl. `DirectionProvider`) as of v1.9.0. No Calendar/DatePicker, DataTable, Tree, FileUpload, Command palette (a Menu filtering API is in preview since v1.9.0). A DateField/DateTimeField exists only on a deploy-preview site. [S5][S2][S18]
- [F] shadcn/ui made **Base UI its default base for new projects in July 2026**, and has had RTL support since January 2026. So "shadcn vs Base UI" is no longer either/or. [S20][S21]
- [F] Base UI RTL is supported via `DirectionProvider` (does **not** set `dir` on the DOM; you must set it yourself) and logical positioning sides (`inline-start`/`inline-end`). RTL keyboard bugs in Combobox/NavigationMenu/ScrollArea/OTP were fixed as recently as May 2026 → RTL is supported but still maturing; test it hard. [S8][S9][S10]
- [F] **Lost Pixel was archived on 2026-04-22** (team joined Figma) → do not adopt. Use Chromatic or Playwright screenshots. [S40]
- [I] Effort: ~4–6 person-months for a solid v1 (tokens + ~40 components + docs + tests), vs ~1–2 months to re-skin shadcn-on-Base-UI. Biggest risks: hidden effort in complex composites (date picker, data table), RTL edge cases, and keeping pace with Base UI minor-release behavior changes.
- **Recommendation:** proceed with Base UI, but treat shadcn's Base UI source (copy-in, MIT) as an optional *reference/scaffold*, own the code in `packages/ui`, drive everything from DTCG tokens, pin Base UI exactly, and gate upgrades with visual + a11y + RTL tests.

**Decision B (Flutter patient app): sound, and well matched to Syria (Android ≈96% of mobile).**
- [F] Current stable: **Flutter 3.47 (2026-08-12) with Dart 3.13** (primary constructors stable); 3.47.8 patch exists. Flutter 3.50 is scheduled for November 2026 (branch cut 2026-10-06); not confirmed shipped as of research date. [S50][S51][S52][S53]
- [F] Official architecture guide = MVVM (View/ViewModel + Repository/Service, optional use-cases), "strongly recommends" layers, repositories, immutable models, DI; "recommends" go_router, Commands, freezed/built_value. [S54][S55]
- [F] Riverpod 3.5.0 (2026-11-06); offline persistence and mutations are still **experimental**. flutter_bloc 9.1.1 is mature (~18 months since last release). [S57][S58][S60]
- [F] Material/Cupertino were split into standalone `material_ui`/`cupertino_ui` 1.0 packages in 3.47; built-ins scheduled for deprecation in the November stable → the framework itself now encourages custom design systems on the widgets layer. [S51][S85]
- [F] Dart & Flutter MCP server is official but labelled experimental; Flutter publishes a Claude Code plugin (`flutter/agent-plugins`) with skills + MCP config, and rules to copy into `CLAUDE.md`. [S87][S88]
- [F] Syria-specific: Google Play reachable since Jan 2026, Firebase reportedly restored (Aug–Sep 2026, community tracker), but **Syria is excluded as a Play Console account country (confirmed by Play support 2026-09-21)**; Apple App Store returned Sep 2025. [S89][S90][S91]
- **Recommendation:** Flutter 3.47.x (move to 3.50 after it stabilises), official MVVM layering with Riverpod 3 as DI + ViewModels, go_router, freezed + json_serializable, swagger_parser-generated Retrofit/Dio client from the NestJS OpenAPI spec, drift (+ PowerSync only if a real bidirectional sync requirement exists), custom design system on the widgets layer fed by the same DTCG tokens, Android-first low-end performance budget.

---

# PART A — Web UI on Base UI

## A1. Base UI status and release history

| Item | Fact | Source |
|---|---|---|
| Package | `@base-ui/react` (renamed from `@base-ui-components/react`) | [S13] |
| 1.0 stable | v1.0.0 on **2025-12-11** (35 components); rc.0 2025-12-04; beta.0 2025-05-29; alpha.4 2024-12-17 | [S1] |
| 2026 releases | v1.1.0 2026-01-15 (CSPProvider, mergeProps export) · v1.2.0 2026-02-12 (Drawer preview) · v1.3.0 2026-03-12 (Drawer stable) · v1.4.0 2026-04-13 (OTPField preview) · v1.4.1 2026-04-20 · v1.5.0 2026-05-19 · v1.6.0 2026-06-18 (OTPField stable; breaking rename of preview namespace) · v1.7.0 2026-08-04 (smaller popup bundle) · v1.8.0 2026-09-04 (Combobox `createItems`) · **v1.9.0 2026-10-09** (Menu filtering preview) | [S1][S2] |
| Latest | v1.9.0 is "Latest" on GitHub; nothing newer found on 2026-11-08 | [S4] |
| v1.9.0 behavior changes (not labelled breaking) | Autocomplete/Combobox/Select unmount decoupled from `actionsRef`; `onItemHighlighted` receives the event; `aria-label` now takes precedence over associated labels on Checkbox/Radio/Switch; ScrollArea viewport role removed; Accordion/Collapsible triggers get native `disabled` | [S2] |
| License | MIT | [S3] |
| Backing | GitHub `mui` org, 7 listed team members, 11.3k stars; "From the creators of Radix, Floating UI, and Material UI"; MUI's 2026 post: MUI Base deprecated and replaced by Base UI, Material UI is being built on Base UI | [S3][S6][S7] |
| React support | React 17/18/19 peer deps; `sideEffects: false` (tree-shakable); depends on `@floating-ui/react-dom` | [S15][S6] |

[I] Cadence (one minor per ~4–6 weeks) plus "behavior changes in minors" (v1.9.0) means: pin an exact version, read release notes on each bump, and upgrade behind visual/a11y/RTL tests.
[I] Backing looks durable: MUI's own flagship (Material UI) is moving onto it, which is a stronger guarantee than a side project.

## A2. Component coverage (v1.9.0, 2026-10-09)

[F] Components (37): Accordion, Alert Dialog, Autocomplete, Avatar, Button, Checkbox, Checkbox Group, Collapsible, Combobox, Context Menu, Dialog, Drawer, Field, Fieldset, Form, Input, Menu, Menubar, Meter, Navigation Menu, Number Field, OTP Field, Popover, Preview Card, Progress, Radio Group, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Toggle Group, Toolbar, Tooltip. Utilities: CSP Provider, Direction Provider, mergeProps, useRender. [S5]
[F] Handbook pages: Styling, Animation, Composition, Customization, Forms, TypeScript; `llms.txt` and per-page `.md` docs exist (useful for agents). [S5]
[F] Forms: Field/Form extend native constraint validation; `validate` (sync/async), `validationMode` (onSubmit/onBlur/onChange); server errors via `<Form errors>`; documented React Hook Form integration via `<Controller>`; Server Actions via `useActionState`. [S19]

### Gaps and recommended companions

| Gap | Status in Base UI | Recommended companion | Notes |
|---|---|---|---|
| Date picker / calendar | Not in stable docs. DateField/DateTimeField appear on a deploy-preview (PR 3666) [S18]; package has optional peer deps `date-fns ^4` and `@date-fns/tz` and internal "temporal adapters" [S15] | **react-day-picker v10** (`@daypicker/react`), v10.0.0 2026-05-08, v10.0.2 2026-09-30; WCAG 2.1 AA claim; Hijri/Persian/Hebrew calendars as separate `@daypicker/*` packages; time-zone support [S23][S24]; wrap in Base UI Popover | [I] Base UI date components look in progress; design your `DatePicker` API so you can swap internals later. Test RTL arrow-key behavior in the grid yourself (RTL not stated on the homepage). |
| Data table / grid | None | **TanStack Table v9** (stable 2026-08-04) + **TanStack Virtual** [S25] | [I] Build `DataTable` as your own composite (sorting, column visibility, sticky header, RTL column order, row virtualization). Heaviest single component. |
| Command palette | None; Menu filtering (`Menu.FilterProvider`, `Menu.Input`) in **preview** since v1.9.0 [S2] | Build on Base UI `Dialog` + `Autocomplete`/`Combobox`; or `cmdk` 1.1.1 | [F] cmdk depends on `@radix-ui/react-dialog`, `react-primitive`, `react-id`, `compose-refs` [S26] → [I] pulls a second primitive stack; prefer Base UI Autocomplete-in-Dialog. |
| Tree view | None | `@headless-tree/react` or `react-arborist` [I, not researched in depth] | Needed for e.g. ICD/department trees. |
| File upload / dropzone | None | `react-dropzone` [I] + Base UI Progress | Medical attachments, lab PDFs. |
| Charts | None | Recharts / ECharts / visx [I] | Check RTL axis mirroring per lib. |
| Others to build yourself | Sidebar/app shell, Breadcrumb, Pagination, Stepper, Badge, Card, Skeleton, Empty state, Kbd, Resizable panels, Rating, Time picker | — | Mostly simple composition; a few (Stepper, Time picker) need care. |

[F] For comparison: a third-party measurement found Base UI Popover + `@internationalized/date` = 46.3 KB gz vs a react-aria date slice + `@internationalized/date` = 73.7 KB gz, and warned that adding react-aria adds "an entire second headless foundation" (~74 KB gz). [S17] [I] Avoid mixing headless foundations unless a component is truly missing.

## A3. RTL support

- [F] `DirectionProvider` (`direction: 'ltr' | 'rtl'`, default `'ltr'`) "enables child Base UI components to adjust behavior based on RTL text direction, but does not affect HTML and CSS"; `dir="rtl"` must be set by your app; `useDirection()` reads it (useful for portaled content). [S8]
- [F] Positioner `side` accepts `'inline-start' | 'inline-end'` in addition to physical sides. [S10]
- [F] PR #4840 (merged 2026-05-18) fixed RTL keyboard/scroll behavior in Combobox (grid nav, chip arrows), Navigation Menu (vertical trigger), Scroll Area (negative `scrollLeft`), added RTL tests for Popover logical sides; PR #4847 (2026-05-19) fixed OTP Field RTL arrows. [S9]
- [U] Third-party Base UI-based libraries report: popups take direction from `DirectionProvider` rather than the document `dir`; submenus open toward inline-end (ArrowLeft opens in RTL). [S10-secondary: docs.twenty.com, neobrutalism.dev]
- [F] shadcn's RTL guide (Jan 2026) converts physical classes to logical ones, flips icons with `rtl:rotate-180`, notes a `tw-animate-css` issue with logical slide utilities (workaround: pass `dir` to portal elements), and recommends fonts with proper script support (Noto). [S21]

[I] Implementation rules:
1. `<html lang="ar" dir="rtl">` server-rendered per locale + `<DirectionProvider direction={dir}>` at the root. Both, always, kept in sync.
2. Ban physical CSS in the design system: lint for `left/right/ml/mr/pl/pr/text-left` (Stylelint `liberty/use-logical-spec` or a Tailwind class lint). Use `inline-start/inline-end` for Positioner `side`.
3. Bidi isolation is critical in healthcare: drug names, lab units (mg/dL), codes (ICD-10), phone numbers, national IDs and MRNs are LTR inside RTL text → wrap in `<bdi>` or `dir="ltr"` + `unicode-bidi: isolate` components (`<LtrText>`, `<PhoneNumber>`, `<Dosage>`).
4. Directional icons (chevrons, arrows, "back") mirror; non-directional (clock, checkmark, media play in some conventions) do not → an `Icon` prop `mirrorInRtl`.
5. Add an RTL+LTR matrix to Storybook and to every visual/a11y test run.

## A4. Accessibility guarantees

- [F] Base UI handles ARIA roles/attributes, keyboard navigation per WAI-ARIA APG (arrows, Home/End, Enter, Esc, typeahead), focus management (`initialFocus`/`finalFocus`); claims testing across browsers, devices, screen readers. It is not presented as a formal guarantee. [S11]
- [F] You own: visible focus styles, color contrast (docs suggest APCA unless stricter rules apply), accessible names for custom controls. [S11]
- [I] Healthcare procurement often asks for WCAG 2.2 AA; budget manual Arabic screen-reader passes (NVDA + Chrome/Firefox, TalkBack, VoiceOver) — automated axe covers only part of WCAG.

## A5. Styling approach

- [F] Unstyled, no bundled CSS. `className` (string or function of state), `style` (object or function), state data attributes (`data-checked`, `data-highlighted`, `data-pressed`, `data-popup-open`, `data-side`, `data-starting-style`, `data-ending-style`, ...), and CSS variables (`--available-height`, `--anchor-width`, `--transform-origin`). Works with Tailwind (`data-highlighted:bg-...`, `origin-(--transform-origin)`), CSS Modules, CSS-in-JS (exported constants for vars/attrs). [S12]
- [F] Composition uses a `render` prop (Base UI's equivalent of Radix `asChild`) and `useRender`/`mergeProps` utilities. [S5]
- [F] Portal setup: wrap app in a root with `isolation: isolate`; iOS 26+ Safari backdrop note (`position: absolute` + `body { position: relative }`). [S13]
- vanilla-extract: [I] works like CSS Modules (static class names + CSS vars); fine but Tailwind v4 has the most ecosystem momentum (shadcn, Base UI examples).
- [F] Tailwind CSS latest: **v4.3.5 (2026-11-06)**; v4.3.0 2026-05-08; v4.2 added logical inset utilities (`inset-s-*`/`inset-e-*`) and deprecated `start-*`/`end-*` [U: sources disagree on exact replacement names]. [S35]

## A6. SSR / Next.js

- [F] Base UI's Next.js guide: Client Components are still server-rendered to HTML; function props can't cross the Server→Client boundary. [S14] (older guide page; quick-start doesn't discuss SSR [S13])
- [F] Package `imports` include "prehydration scripts for tabs and slider thumbs" → SSR hydration has been considered. [S15]
- [I] Pattern: design-system components are client components (`'use client'` at the top of each `packages/ui` component file that uses state/Base UI); pages stay Server Components and pass serialisable props. Next.js current major is 16 (React 19.2, Oct 2025); a secondary source reports 16.3.x + React 19.3 by Sep 2026 [U]. [S47]

## A7. Bundle size

- [F] Tree-shakable (`sideEffects: false`), per-component entry points. Whole package ≈ 453.7 KB min / 142.6 KB gz per depscope (full package, not what an app ships). v1.7.0 reduced popup bundle size. [S15][S16][S1]
- [I] Measure your actual pages with `@next/bundle-analyzer`; expect a typical app shell (Dialog, Menu, Popover, Select, Tooltip, Toast, Tabs, Field) to land in the tens of KB gz, comparable to Radix.

## A8. How professional teams build a design system on headless primitives (2026)

### A8.1 Token pipeline (single source → web + Flutter)

```
Figma Variables (collections: primitives, semantic[light|dark], tenant-overridable)
  │  export: native DTCG JSON per mode (UI-only)  OR  Tokens Studio (DTCG mode) / TokensBrücke plugin
  ▼
packages/tokens/src/**/*.tokens.json      ← DTCG 2025.10, reviewed in PRs (source of truth = git, not Figma)
  │  build: Style Dictionary v5 (or Terrazzo)
  ├─► dist/css/tokens.css          (:root, [data-theme=dark], CSS custom properties)
  ├─► dist/tailwind/theme.css      (Tailwind v4 @theme / @theme inline mapping to the CSS vars)
  ├─► dist/ts/tokens.ts            (typed token names/values for JS, charts, emails)
  └─► dist/dart/app_tokens.dart    (+ ThemeExtension classes) → consumed by the Flutter app
```

- [F] DTCG spec first stable version **2025.10** (2025-10-28), with theming/multi-file support and modern color spaces (Display P3, OKLCH); reference implementations: Style Dictionary, Tokens Studio, Terrazzo. [S27]
- [F] Style Dictionary latest **v5.8.0 (2026-11-03)**; v5.7.0 (2026-10-16) added DTCG 2025.10 `duration`; v5.x aligned reference syntax with DTCG. Built-in formats include `css/variables`, `flutter/class.dart` (Dart class of static consts: `Color(0x..)`, doubles, strings), `compose/object`, iOS/Android formats. [S28][S29]
- [F] Terrazzo (ex-Cobalt UI) is DTCG-native and has a Tailwind v4 theme plugin (`@terrazzo/plugin-tailwind`). [S30]
- [F] Figma: native export of a variable collection to DTCG JSON (one file per mode) exists in the UI; REST API does not return DTCG; native import unconfirmed [U]. [S32] Extended collections (multi-brand) are **Enterprise-only**. [S33]
- [F] Tokens Studio: per-file switch from legacy to DTCG format; `@tokens-studio/sd-transforms` bridges to Style Dictionary. [S34]
- [F] Flutter-side generators: Style Dictionary `flutter/class.dart` gives flat constants; `dtcg_theme` 0.7.1 (pub.dev) generates a `ThemeExtension` per mode from DTCG (young package; Tokens Studio dialect "not yet verified"). [S29][S31]
- [I] Recommended: **Style Dictionary v5** with a small custom Dart format that emits (a) `AppColors`/`AppSpacing` constants and (b) `ThemeExtension<AppSemanticColors>` with `copyWith`/`lerp` for light/dark. Writing ~150 lines of custom format is cheaper and safer than depending on a 0.x generator. Terrazzo is a fine alternative if you want first-class Tailwind v4 output.
- [I] Make git the source of truth; Figma exports go through a PR (diff review), not straight to prod.

### A8.2 Token layers
- **Primitive** (raw, never used by components): `color.teal.50…950` (OKLCH), `space.0…16`, `radius.*`, `font.size.*`, `duration.*`, `easing.*`.
- **Semantic** (what components use): `color.bg.canvas|surface|raised|overlay`, `color.text.primary|secondary|disabled|on-brand`, `color.border.default|strong|focus`, `color.action.primary.bg|bg-hover|fg`, `color.status.success|warning|danger|info.{bg,fg,border}`, plus **clinical semantics** you will need: `color.clinical.critical|abnormal-high|abnormal-low|normal`, `color.triage.1…5`. Modes: light, dark, (high-contrast later).
- **Component** (thin, only where a component needs an independent knob): `button.primary.bg`, `input.border`, `table.row.hover`. [I] Keep this layer small; most components should reference semantic tokens directly.

### A8.3 Theming per tenant (clinic branding) and dark mode — [I]
- Define a **tenant-overridable contract**: only a handful of semantic tokens (brand primary hue/chroma, brand accent, logo, optionally radius scale). Never let tenants touch status/clinical colors (patient safety: red must always mean critical).
- Generate the tenant's tonal scale **server-side** (NestJS) from one brand color in OKLCH, validate contrast (WCAG 2.x AA and/or APCA) for both light and dark, store the *resolved* token values, and serve `GET /tenants/:id/theme` (ETag-cached).
- Web: SSR inject `<style>[data-tenant="…"]{--color-brand-500:…}</style>` (or inline CSS vars on `<html>`); Tailwind utilities reference vars, so no rebuild per tenant. Dark mode via `[data-theme="dark"]` + `color-scheme`, defaulting to `prefers-color-scheme`.
- Flutter: same JSON → runtime `ThemeExtension` instance (the static generated one is the fallback). One algorithm, implemented once (server), consumed by both clients.
- Patient app nuance: a patient may belong to several clinics → platform brand for the shell, clinic accent only inside clinic-scoped screens.

### A8.4 RTL with CSS logical properties — [I]
- Tailwind v4 logical utilities (`ms-/me-`, `ps-/pe-`, `border-s/e`, `rounded-s/e`, `text-start/end`, logical inset) + `rtl:`/`ltr:` variants only for genuine exceptions (icon mirroring, asymmetric shadows). Animations: slide-from-inline-end, not from-right. Keep a lint rule against physical classes.

### A8.5 Arabic typography scale — mostly [I], with sourced guidance
- [F/U] Guidance across sources: Arabic appears smaller at the same font-size and needs more line height (Material language-support guidance gives no fixed multiplier); vendor guidance ranges 1.5–1.8 line-height for Arabic body; keep letter-spacing 0 (tracking breaks joins); avoid fixed % boosts, tune with rendered tests. [S44]
- Proposed starting tokens (tune with real Arabic medical copy):

| Token | Size (px) | Line-height | Weight | Use |
|---|---|---|---|---|
| display | 36 | 1.25 | 700 | Dashboards KPIs |
| h1 | 30 | 1.3 | 700 | Page titles |
| h2 | 24 | 1.35 | 600 | Section |
| h3 | 20 | 1.4 | 600 | Card titles |
| body-lg | 18 | 1.7 | 400 | Patient-facing text |
| body | 16 | 1.7 | 400 | Default (never below 16 for Arabic body) |
| body-sm | 14 | 1.6 | 400 | Dense tables (staff only) |
| caption | 13 | 1.5 | 500 | Meta, labels |
- Fonts [I]: pair an Arabic family with metric-compatible Latin: IBM Plex Sans Arabic + IBM Plex Sans, or Noto Sans Arabic + Noto Sans/Inter; alternatives Readex Pro, Cairo, Tajawal, Almarai. Self-host (fontsource / `next/font/local`), subset, `font-display: swap`. No italics, no all-caps semantics. Tabular numerals for tables (`font-variant-numeric: tabular-nums`) — check the chosen font supports it for both digit sets.
- Digits: [F] CLDR's default numbering system for base `ar` is Arabic-Indic (`arab`), while some regional locales (ar-MA, ar-DZ) default to `latn`; `-u-nu-latn` forces Western digits. [S46] [U] `ar-SY` most likely defaults to `arab` — verify with `new Intl.NumberFormat('ar-SY').resolvedOptions().numberingSystem`. [I] Make this an explicit product decision (tenant/user setting), and for clinical values consider Western digits for unambiguous dosing; apply the same rule in Flutter.
- Month names: [U] ICU `ar_SY` historically uses Levantine month names (كانون الثاني، شباط …); verify current output for `ar-SY` vs generic `ar` and choose deliberately.
- Plurals: [F] Arabic has 6 CLDR cardinal categories (zero, one, two, few, many, other). [S45] Use ICU MessageFormat on web (next-intl / FormatJS) and ARB plurals in Flutter.

### A8.6 Component API conventions — [I]
- Two tiers: (1) **compound parts** that mirror Base UI anatomy (`Dialog.Root/Trigger/Popup/Title/Description/Close`) styled by your tokens; (2) **pre-composed convenience components** for 80% cases (`<ConfirmDialog>`, `<SelectField label error options>`).
- Props: `variant`, `size`, `tone` (semantic), `value/defaultValue/onValueChange` (match Base UI naming), `render` for polymorphism (no `as`, no `asChild`), ref as prop (React 19), logical naming only (`side="inline-end"`, `iconStart`/`iconEnd`, never left/right).
- Variants via `tailwind-variants` (slots) or `cva`; expose `data-slot` attributes for targeted overrides; `className` merged with `tailwind-merge`.
- Every component ships: story set (states × LTR/RTL × light/dark × tenant sample), a11y test at `'error'`, a usage doc (do/don't), and a typed props table.

### A8.7 Documentation with Storybook
- [F] Storybook **10.6.6 (2026-11-05)** stable; 11.0.0-beta.0 (2026-11-03). Storybook 10 (2025-10-28) is ESM-only, Node 20.16+/22.19+/24+. [S36]
- [F] `@storybook/addon-a11y` (axe-core) + `@storybook/addon-vitest`; `parameters.a11y.test: 'error' | 'todo' | 'off'`; a11y runs in CI for `'error'` stories. [S37]
- [F] **Storybook MCP** (`npx storybook add @storybook/addon-mcp`, status: preview): dev/docs/testing toolsets; docs toolset needs the components manifest (available for React frameworks incl. React Vite and Next.js); Chromatic can host the MCP server. [S38]
- [I] Stay on 10.x until 11 is stable for a few months.

### A8.8 Visual regression
- [F] Chromatic: free 5,000 snapshots/month (Chrome only); Starter ≈ $179/mo for 35k [U: aggregator-confirmed, vendor page authoritative]. [S39]
- [F] **Lost Pixel archived 2026-04-22** ("sunsetting the product", team joining Figma). [S40]
- [I] Options: (a) Chromatic (lowest effort, Storybook-native; snapshot count multiplies with LTR/RTL × theme × tenant — budget it); (b) self-hosted Playwright `toHaveScreenshot` over Storybook story URLs in a pinned Docker image (free, more maintenance); (c) Argos as a hosted alternative. Recommended: start with Playwright-in-Docker for components (cost control given the 4–8× matrix), add Chromatic later if review UX matters.

### A8.9 Accessibility testing — [I]
- Component level: Storybook a11y addon at `'error'`. App level: `@axe-core/playwright` on key flows (login, booking, prescription, patient record). Manual: quarterly Arabic screen-reader pass, keyboard-only pass, 200% zoom, forced-colors.

### A8.10 Monorepo layout and versioning (pnpm + Turborepo) — [I]
```
packages/tokens      DTCG source + Style Dictionary build → css/tailwind/ts/dart outputs
packages/ui          React components on @base-ui/react (+ Storybook)
packages/icons       SVG → React components (mirrorInRtl metadata)
packages/config      eslint/tsconfig/tailwind presets
apps/web, apps/admin Next.js apps consuming packages via "workspace:*"
apps/patient_mobile  Flutter app (pub workspace inside the same repo, see B9)
```
- Internal packages consumed via `workspace:*` (no publishing) while there is one product team; add **Changesets** only when external/independent consumers appear. Turborepo caches `tokens#build` → `ui#build` → app builds; the Flutter app depends on `tokens#build` output (copied or path-referenced Dart file).

### A8.11 Claude Code + design system
- [F] Figma MCP server: remote server recommended (hosted, broadest features incl. write-to-canvas in beta); desktop server for specific org needs; Claude Code supported (desktop, remote, write-to-canvas, plugin/skills). [S41] [U] Plugin install: `claude plugin install figma@claude-plugins-official`. [S43]
- [F] **Code Connect**: maps Figma components to code so the MCP server returns your real components; CLI (template files, framework-agnostic) or UI (GitHub integration). **Professional plan = one active framework**; Organization/Enterprise = multiple frameworks (needed if you want React *and* Flutter mappings). Requires Dev or Full seat. Flutter is not listed by name; template files are framework-agnostic. [S42]
- [F] Base UI publishes `llms.txt` and `.md` versions of every doc page. [S5]
- [I] Agent workflow that works:
  1. A repo skill `.claude/skills/design-system/` with: token contract (names + meaning), component index (generated from the Storybook manifest), API conventions (A8.6), RTL rules (A3), and "never hardcode colors/spacing; never use physical properties".
  2. Storybook MCP for discovery + running story/a11y tests; Figma MCP + Code Connect for design-to-code; Base UI `.md` docs as reference.
  3. Hooks/CI that reject physical CSS, raw hex values, missing stories, and a11y `'error'` failures — agents follow guardrails better than prose.

## A9. Assessment vs shadcn/ui

| Dimension | Custom on Base UI | shadcn/ui (with Base UI base) |
|---|---|---|
| Primitive layer | Same (`@base-ui/react`) | Same — [F] Base UI is shadcn's default base for new projects since Jul 2026; Radix and React Aria also supported [S20] |
| Visual identity | Fully yours from day 1 | Starts as "shadcn look"; must be re-skinned to avoid generic feel |
| Code ownership | Yours | Also yours (copied into repo, MIT) — not a runtime dependency |
| RTL | You build it | [F] Built-in RTL conversion (Jan 2026), logical classes, inline-start/end side styles [S20][S21] |
| Coverage | 37 primitives + what you build | Many more ready composites (Calendar, Data table recipes, Sidebar, Command, Charts, Blocks) |
| Upgrades | You track Base UI only | You track Base UI + optionally pull shadcn updates (merge pain once customised) |
| Effort to v1 | ~4–6 person-months [I] | ~1–2 person-months to re-skin [I] |
| Agent friendliness | Needs your own skill/docs | Huge training-data footprint; shadcn MCP/registry tooling |

[I] Verdict: the owner's goal (distinct, professional, healthcare-grade, RTL-first brand) is achievable either way; the real differentiator is the **token system and composite components**, not the primitive wrappers. A pragmatic hybrid that respects "no shadcn" as a *product/visual* decision: use shadcn's Base UI component source only as reading material/reference for complex composites (calendar, data table, sidebar), never as the visual baseline.

## A10. Effort estimate — [I]
Assumes 1 senior React engineer full-time + designer part-time, Claude Code assisting.
| Work package | Estimate |
|---|---|
| Foundations: tokens pipeline (web + Dart output), tenant theme service contract, dark mode, typography, icons, RTL infra, Storybook, CI (visual + a11y + lint rules) | 4–6 weeks |
| ~25 primitive-backed components (Button … Tooltip, Field family, Select/Combobox/Autocomplete, Dialog/Drawer/AlertDialog, Menu, Tabs, Toast…) incl. stories/tests/docs | 8–11 weeks |
| Composites: DatePicker/DateRange, DataTable (sort/filter/virtualize/RTL), Command palette, FileUpload, AppShell/Sidebar, Stepper, Charts wrappers, Empty/Error states | 6–9 weeks |
| Hardening: Arabic screen-reader pass, performance, docs polish | 2–3 weeks |
| **Total** | **~20–29 weeks (≈4.5–6.5 person-months)**; Claude Code can cut the primitive-wrapper phase noticeably, much less so the composites and RTL/a11y verification. |

## A11. Risks and mitigations — [I] unless marked
1. **Minor releases change behavior** ([F] v1.9.0 [S2]) → pin exact version, Renovate PRs, full visual/a11y/RTL matrix on bump.
2. **RTL still maturing** ([F] fixes in May 2026 [S9]) → RTL keyboard tests (Playwright) for Menu, Combobox, Tabs, Slider, NavigationMenu, Toast swipe, Drawer swipe; upstream bugs fast (MIT, active repo).
3. **Missing date components** → own `DatePicker` API now (react-day-picker inside), swap later if Base UI ships one.
4. **Scope creep / under-estimation of composites** → ship v1 with a defined component inventory driven by actual screens.
5. **Token drift between web and Flutter** → one DTCG source, CI check that both builds are regenerated and committed.
6. **Visual-test cost explosion** (LTR/RTL × light/dark × tenants) → test 2 representative tenants, not all.
7. **Bus factor** → docs-as-skills + Storybook as the contract.

## A12. Recommendation — Decision A
**Adopt Base UI (pinned `@base-ui/react@1.9.x`) as the only headless foundation, with a token-first custom design system.** Concretely:
1. Build `packages/tokens` first (DTCG 2025.10, Style Dictionary v5 → CSS vars + Tailwind v4 theme + TS + Dart ThemeExtension), including the tenant-overridable contract and clinical semantic colors.
2. Tailwind v4.3 + `tailwind-variants`, logical properties only, `DirectionProvider` + `dir` always paired, bidi-isolation components for clinical data.
3. Companions: react-day-picker v10, TanStack Table v9 + Virtual, React Hook Form (documented Base UI integration) + Zod, react-dropzone; build the command palette on Base UI (avoid cmdk's Radix deps).
4. Storybook 10.6 with a11y (`'error'`), Vitest addon, RTL/theme/tenant toolbar; Playwright screenshots in Docker (or Chromatic); **not Lost Pixel**.
5. Claude Code: design-system skill + Storybook MCP + Figma MCP/Code Connect; CI guardrails.
6. Re-evaluate at 6 weeks: if foundations slip, fall back to scaffolding composites from shadcn's Base UI source while keeping your tokens and visual language.

---

# PART B — Flutter patient app

## B1. Versions (as of 2026-11-08)
- [F] Flutter **3.47** (blog 2026-08-12), docs reflect 3.47; **3.47.8** security patch (blocks compromised eMudhra CA keys). [S50][S51]
- [F] Dart **3.13.0** released 2026-08-12; primary constructors stable (preview in 3.12). [S52]
- [F] 2026 cadence: ≥4 stable releases; 3.41 (Feb), 3.44 (May), 3.47 (Aug), **3.50 scheduled November** (branch 2026-10-06) — not confirmed released on 2026-11-08 [U]. [S53]
- [F] 3.47 highlights: `material_ui`/`cupertino_ui` 1.0 standalone (opt-in; built-ins scheduled for deprecation in the November stable; `dart fix --apply --code=migrate_design_widgets`); Widget Previews stable; Impeller default on desktop; Android defaults compileSdk/targetSdk 36, **minSdk 24**; iOS min 15; Android high-contrast/color-inversion now detected (`MediaQueryData.highContrast`, `invertColors`); GenUI 0.10.0. [S51][S85]

## B2. Official app architecture guide
- [F] Guide (last updated 2026-05-05): MVVM; UI layer = Views (no business logic) + ViewModels (state + Commands); Data layer = Repositories (single source of truth, caching, retry, domain models; must not depend on each other) + Services (stateless wrappers over APIs/platform); optional Domain layer (use-cases) only when merging repositories, very complex, or reused logic. [S54]
- [F] Recommendations (strength): Strongly — separate data/UI layers, repository pattern, MVVM, no logic in widgets, unidirectional data flow, immutable models, DI, abstract repositories, test layers separately and together, fakes for testing. Recommend — Commands, freezed/built_value, **go_router**, naming conventions. Conditional — ChangeNotifier/Listenable, domain layer, separate API vs domain models. Packages named: provider (DI), go_router, freezed, built_value, flutter_lints, very_good_cli; reference app: **Compass**. [S55]
- [F] Offline-first pattern page: repository combines local DB + remote API; stream local data first then server data; write strategies (background sync vs explicit vs online-only); optimistic state pattern. [S56]
- Adoption: [F] no public survey with MVVM/state-management percentages for 2025–2026 was found; the latest LeanCode CTO report (2024 data) names architecture as the top challenge for new teams. [S48] [I] In practice the guide is becoming the "neutral" reference that both Riverpod and Bloc teams map onto (ViewModel = Notifier/Cubit), and Flutter's own agent plugin ships a `flutter-apply-architecture-best-practices` skill [S88], which will push adoption further.

## B3. State management (2026)
| Option | Status | Fit |
|---|---|---|
| **Riverpod 3.x** | [F] 3.0.0 stable 2025-09-10; **3.5.0 2026-11-06**; 4.27M downloads (30-day pub.dev metric), 2.92k likes; offline persistence (`persist`, riverpod_sqflite, 2-day default cache) and mutations are **experimental**; codegen optional but recommended by docs [S57][S58][S59] | [I] Best fit: DI + async state + streams from drift in one tool; ViewModel = `Notifier/AsyncNotifier`; easy test overrides (fakes). |
| **Bloc/Cubit** | [F] flutter_bloc 9.1.1 (~18 months old), 8.09k likes, 2.28M downloads [S60] | [I] Excellent for strictly event-sourced flows/audit trails and very large teams; more boilerplate; needs separate DI (get_it/provider). |
| **Signals** | [F] signals 7.1.0 (~5 months), 714 likes, 25.3k downloads [S61] | [I] Elegant fine-grained reactivity; ecosystem and hiring pool much smaller → not for a medium-large regulated app. |
| **Provider + ChangeNotifier** | [F] provider 6.1.5+1 (~14 months), 11k likes, Flutter Favorite; used by the official guide [S62][S55] | [I] Fine for small apps; lacks async/caching ergonomics for offline sync. |

[I] **Recommendation:** Riverpod 3 for DI + ViewModels, following the official layering. Do **not** use Riverpod's experimental offline persistence for clinical data; persistence belongs in drift (repository layer). Use codegen (`riverpod_generator`) only if you already run build_runner for freezed (you will) — keeps providers uniform and agent-friendly.

## B4. Package set (versions as observed 2026-11-08 on pub.dev)
| Concern | Pick | Version / status | Notes |
|---|---|---|---|
| Routing | **go_router** + go_router_builder (typed routes) | [F] 18.1.3, flutter.dev publisher, "feature-complete" (bug fixes only) [S63] | [I] Stable choice; deep links from push notifications; redirect guards for auth/biometric lock. |
| Models | **freezed** + json_serializable | [F] freezed 4.0.3 (~3 weeks); notes Dart 3.13 primary constructors are stable so freezed no longer needs to generate them [S64] | [I] Sealed unions for API states. Alternative **dart_mappable** 4.10.0 (generics/polymorphism, copyWith) [S65] — pick one, not both. |
| HTTP | **dio** + **retrofit** | [F] retrofit 4.10.0 (~2 months), supports DartMappable parser, SSE streams [S66] | Interceptors: auth refresh, tenant header, locale header, Sentry breadcrumbs. |
| Client generation from NestJS OpenAPI | **swagger_parser** | [F] 1.46.0 (2 days old); OpenAPI 2/3.0/3.1; generates Retrofit clients + json_serializable/freezed/dart_mappable models; tag filtering [S67] | [F] Alternative openapi-generator `dart-dio`: STABLE generator, but default serializer is built_value; json_serializable and freezed serializers are **BETA** [S68]. [I] swagger_parser matches the freezed/retrofit stack; generate into `packages/api_client`, CI fails if the spec changed without regen. |
| Local DB | **drift** | [F] 2.35.3 (~2 weeks), sponsored by Stream and PowerSync [S69] | Reactive `watch()` queries feed Riverpod StreamProviders. |
| Sync engine (optional) | **PowerSync** | [F] powersync 2.6.1 (2 days); backends Postgres/MongoDB/MySQL/SQL Server; Drift via `drift_sqlite_async` (docs say alpha/beta — conflicting); Sync Streams production-ready and recommended (Feb 2026); Open Edition self-host free (source-available FSL; docs call it beta), client SDKs Apache-2.0 [S70][S71] | See B5. |
| Push | **firebase_messaging** | [F] 17.0.1 (~2 weeks) [S72] | [I] Requires Google Play services; plan a fallback for non-GMS devices (in-app inbox polling/SSE). See B11 for Syria status. |
| L10n | flutter_localizations + gen-l10n (ARB) + intl | — | [F] Arabic needs 6 plural forms [S45]; decide digits (arab vs latn) and month-name style explicitly (see A8.5). |
| Charts | **fl_chart** (or CustomPainter) | [F] 1.3.0 (~17 days); RTL not documented [S82] | [I] flutter_svg is *not* a chart library — use it for icons/illustrations only. Test axis direction in RTL; time axes usually stay LTR. |
| Secure storage | **flutter_secure_storage** | [F] 11.2.0; Jetpack EncryptedSharedPreferences no longer recommended; custom ciphers (RSA-OAEP + AES-GCM, Keystore); optional biometrics; disable Android Auto Backup [S73] | [I] Store tokens + DB encryption key here; encrypt drift DB with SQLCipher (PHI at rest). |
| Errors/APM | **sentry_flutter** → Sentry or self-hosted **GlitchTip** | [F] sentry_flutter 10.3.0 (5 days; iOS via SPM only); GlitchTip documents Flutter via `sentry_flutter` (errors on all platforms) [S74] | [I] GlitchTip self-hosted = data residency + cost; scrub PHI in `beforeSend`; upload debug symbols when using `--split-debug-info`. |
| Lints | **very_good_analysis** | [F] 11.0.0 (~2 months) [S75] | [I] Stricter than flutter_lints → better guardrails for agent-written code. |
| Golden tests | **alchemist** | [F] 0.14.1 (~30 days), CI goldens (Ahem font) vs platform goldens [S76] | [I] Run platform goldens with the real Arabic font in a pinned Linux Docker image; CI goldens for layout. |
| Integration/E2E | **patrol** (+ Maestro for black-box smoke) | [F] patrol 4.11.0 (4 days), native automation, ships agent skills [S77]; Maestro supports Flutter via Semantics identifiers (Flutter 3.19+), not Keys [S78] | [I] Patrol for permission dialogs/notifications/biometric flows in CI; Maestro flows for release smoke on real low-end devices. |
| Component catalog | Widget Previews (stable 3.47) and/or **Widgetbook** | [F] widgetbook 3.25.0 (4.0.0-beta.15); Cloud offers visual PR review/Figma compare [S86] | [I] Widgetbook = Storybook-equivalent for the Flutter design system. |
| Monorepo | **pub workspaces + Melos 8** | [F] pub workspaces since Dart 3.6 (globs need 3.11+); Melos 8.10.1, config moved into root `pubspec.yaml`, requires Dart ≥3.9 [S79] | [I] Flutter workspace lives under `apps/patient_mobile` + `packages/flutter_*` inside the pnpm/Turborepo repo; Turborepo calls Melos scripts via a thin `package.json` in the Flutter workspace root. |
| Flavors | `--flavor dev/staging/prod` + `--dart-define-from-file` | — | Separate Firebase projects/Sentry DSNs/API base URLs per flavor. |
| Code push | **Shorebird** (optional) | [F] 1.0 with stable iOS; roadmap item to track latest Flutter "in progress" (Q2 2026); pricing not verified (third-party: Free / $20 Pro / $400 Business) [S80][U] | [I] Valuable for hotfixing Dart-only bugs; adds a forked engine dependency → adopt after first stable release, verify 3.47 support first. |

## B5. Offline sync design — [I] (grounded on [S56][S58][S70][S71])
- Patient app data is mostly **read-heavy** (appointments, prescriptions, lab results, invoices, profile) with a few writes (book/cancel, forms, messages, uploads).
- **Option 1 (default): drift cache + outbox.** Repositories implement the official offline-first pattern (emit local, refresh from API, upsert), writes go to an `outbox` table with idempotency keys and are replayed by a sync worker; server stays authoritative. Simple, no extra infra.
- **Option 2: PowerSync** when you need real bidirectional sync for many entities or the clinic/staff app also needs offline. Postgres logical replication → PowerSync Service (self-host Open Edition for data residency, or Cloud) → client SQLite; client writes are uploaded through your **NestJS API** (keeps validation/authorization/audit in one place); tenant scoping via Sync Streams parameters from JWT claims. Risks: drift integration labelled alpha/beta, Open Edition labelled beta, extra service to operate.
- Either way: encrypt the local DB, wipe on logout/tenant switch, show data freshness ("updated 3h ago"), and never present stale clinical results without a timestamp.

## B6. Localization and RTL in Flutter — [I] unless marked
- `supportedLocales: [Locale('ar','SY'), Locale('en')]`, default Arabic; `Directionality` comes from locale automatically; use `EdgeInsetsDirectional`, `AlignmentDirectional`, `PositionedDirectional`, `TextAlign.start`; mirror directional icons (`Icon` with `matchTextDirection: true`).
- Bidi for clinical strings: wrap LTR fragments (drug names, units, phone) with `Directionality(textDirection: TextDirection.ltr)` or Unicode isolates (`⁦…⁩`).
- ARB with ICU plurals (6 Arabic categories) and gender where needed; date/number formatting centralised in one `Formatters` service so the digit-system decision is applied consistently across web and mobile.
- Fonts: bundle the same Arabic family as web (subset), set `height` per text style (1.5–1.8 for body), never letter-spacing on Arabic.

## B7. "Creative and professional" UI
**Design system approach — [I] grounded on [F] decoupling [S51][S85]:**
- Build an app-specific design system on the widgets layer with tokens from `packages/tokens` (ThemeExtension for semantic colors/spacing/radii/motion), wrapping only the Material components you actually need (TextField, DatePicker dialog, BottomSheet) themed via `ThemeData` from the same tokens. With Material now a separate package and the SDK moving toward a style-neutral core, a custom system is the direction the framework itself is going.
- Avoid shipping "default Material 3 look"; healthcare-appropriate style = calm, high-contrast, generous spacing, large touch targets (≥48dp), clear status semantics.

**Motion:**
- Implicit animations (`AnimatedContainer`, `AnimatedSwitcher`, `TweenAnimationBuilder`) for 80% of state changes; explicit (`AnimationController`, staggered) for onboarding/hero sequences; `Hero` + shared-axis/fade-through page transitions.
- [F] flutter_animate 4.5.2 (gskinner) — last published ~23 months ago (stable but stale) [S81]. [I] fine for declarative effects; wrap behind your own `Motion` helpers so it can be replaced.
- [F] Rive 0.14.11 (new runtime in `rive_native`, Rive renderer on all platforms, data binding) [S81]; [F] lottie 3.8.2 (pure Dart, `renderCache`, frame-rate control) [S81]. [I] Use Rive for 2–3 signature moments (onboarding, empty states, success confirmations) and measure APK impact of `rive_native` native libs; Lottie for simple illustrations.
- Motion tokens (durations/easings) come from the same DTCG source as web; honour `MediaQuery.disableAnimations` (reduce motion).

**Adaptive layouts:** [I] phone-first, but `LayoutBuilder`/breakpoints for tablets (clinics often use tablets in waiting rooms); Flutter's agent plugin includes a `flutter-build-responsive-layout` skill [S88].

**Performance on low-end Android:**
- [F] Impeller is default on Android **API 29+ with Vulkan**; lower API levels or devices without Vulkan fall back automatically to the legacy OpenGL renderer; opt-out via `--no-enable-impeller` / manifest `EnableImpeller=false` still exists (docs updated 2026-08-21). [S83]
- [F] Syria: Android ≈96% of mobile/tablet traffic (StatCounter, Jun 2026); Android 11 and 12 still ~10–14% each in Jun–Jul 2026 pages. [S92] [I] Expect many budget devices → set a perf budget (cold start < 2.5s on a ~2 GB RAM device, 60fps scrolling lists), test on real low-end hardware on both Vulkan and GL paths, avoid heavy shaders/blur on lists, cache images (`cacheWidth`), use `const` widgets, profile with DevTools.
- [F] App size: `--split-debug-info` (+ `--obfuscate`), remove unused resources, compress images, `--analyze-size`. [S84] [I] For sideloaded APKs use `--split-per-abi` (arm64-v8a + armeabi-v7a); for Play use AAB.
- [F] Deferred components on Android rely on Play dynamic feature modules (custom manager possible but undocumented) [S84] → [I] not worth it if part of distribution is direct APK.

**Accessibility:** [I] Semantics labels in Arabic, `Semantics(identifier:)` for tests (doubles as Maestro IDs [S78]), text scaling to 200% without overflow (golden tests at 1.0/1.3/2.0), contrast from tokens, `MediaQueryData.highContrast` support (3.47 [S51]), TalkBack pass in Arabic.

## B8. Testing strategy — [I]
- Unit: repositories/ViewModels with fakes (as the guide recommends [S55]).
- Widget: every design-system widget + key screens; RTL/LTR + text scale matrix.
- Golden: alchemist; run in Docker for determinism.
- Integration: patrol on Android emulators in CI (Firebase Test Lab or self-hosted), Maestro smoke on 2–3 physical low-end devices before release.
- Contract: regenerate API client from the NestJS spec in CI; break the build on drift.

## B9. Monorepo with the TypeScript repo — [I] grounded on [S79]
```
pnpm-workspace.yaml / turbo.json
packages/tokens          → also emits dart/ (consumed by flutter packages)
apps/patient_mobile      Flutter app  (pubspec: resolution: workspace)
packages/flutter_ui      Flutter design system (ThemeExtension, widgets)
packages/flutter_api     generated swagger_parser client
pubspec.yaml (root of Flutter workspace, Melos 8 config under `melos:`)
```
- Turborepo task `mobile#test` → `melos run test`; caching via Turborepo inputs (lib/**, pubspec.lock).

## B10. Syria-specific constraints (important for both decisions)
- [F] Google Play reachable without VPN for "many users" since 2026-01-18 (minister statement). [S89]
- [F] Community tracker (as of 2026-10-07): Firebase restored for Syria (entries 2026-08-31, 2026-09-08); **Play Developer Support confirmed 2026-09-21 that Syria is excluded at the account-country level** (no paid content/IAP; no timeline). [S90][U: community source, but quoting Google support]
- [F] Apple products/App Store returned to Syria (Sep 2025) under a US Commerce license exception. [S91]
- [I] Consequences: publish through a developer account/entity registered outside Syria (or accept direct APK distribution + Play later), avoid paid IAP in-app, keep a non-FCM notification fallback, self-host fonts/assets and prefer self-hostable observability (GlitchTip) and sync (PowerSync Open Edition) where data residency matters. Get legal advice on data residency for health data.

## B11. Claude Code + Flutter
- [F] Official route: `claude plugin marketplace add flutter/agent-plugins` then `claude plugin install dart-flutter@dart-flutter` (bundles skills + MCP config); Claude Code does **not** auto-load plugin rules → copy chosen rules from `flutter/agent-plugins/rules` into `CLAUDE.md`. Generic MCP config: `{"command":"dart","args":["mcp-server"]}`. Docs updated 2026-09-14. [S87][S88]
- [F] Dart MCP server: experimental ("WIP"), needs Dart ≥3.9; tools include `analyze_files`, `dart_fix`, `dart_format`, `run_tests`, `pub`, `pub_dev_search`, `hot_reload`, `hot_restart`, `get_runtime_errors`, `widget_inspector`, `launch_app`, `list_devices`, `lsp`, `flutter_driver_command`, `read_package_uris`, `rip_grep_packages` (some disabled by default). [S87]
- [F] Plugin skills: add-integration-test, add-widget-preview, add-widget-test, apply-architecture-best-practices, build-responsive-layout, fix-layout-issues, implement-json-serialization, setup-declarative-routing, setup-localization, use-http-package; Dart skills separately in `dart-lang/skills`. [S88] Patrol also ships agent skills. [S77]
- [I] Best practices for agent-driven Flutter work:
  1. CLAUDE.md: architecture map (feature folders: `ui/<feature>/{view,view_model}`, `data/{repositories,services}`), state-management rules (Riverpod patterns allowed), "no Material defaults outside packages/flutter_ui", RTL rules, digits/plurals policy.
  2. Hard guardrails: very_good_analysis at zero warnings, `dart format` check, build_runner up-to-date check, golden + widget tests in CI; agents iterate until green.
  3. Let the agent run the app via MCP (`launch_app`, `hot_reload`, `get_runtime_errors`, `widget_inspector`) for UI tasks, and Widget Previews for isolated widgets.
  4. Keep generated code (API client, freezed) out of agent edits — regenerate instead.
  5. Feature templates (one ViewModel + View + repository fake + tests) so agents copy patterns, not invent them.

## B12. Risks — [I]
1. Riverpod experimental features (offline/mutations) change without major bump → avoid them for core flows.
2. PowerSync + drift integration maturity (alpha/beta labels) → start with Option 1; spike PowerSync before committing.
3. Flutter 3.50 (Nov 2026) will deprecate built-in Material/Cupertino → migrate imports to `material_ui` early (one `dart fix`).
4. Low-end device performance/regressions in Impeller GL fallback → device lab, keep the opt-out path known.
5. Store/distribution constraints in Syria (Play Console account country) → legal entity/account planning now.
6. Shorebird engine fork lag behind Flutter stable → treat as optional.
7. flutter_animate staleness → wrap behind own API.

## B13. Recommendation — Decision B
**Proceed with Flutter.** Concretely:
1. Flutter 3.47.x / Dart 3.13 now; upgrade to 3.50 ~4–6 weeks after release; migrate to `material_ui` package.
2. Official MVVM layering (Views, ViewModels with Commands, Repositories, Services; use-cases only when justified) with **Riverpod 3** for DI/state; freezed + json_serializable; go_router (+ builder); dio + retrofit client generated by **swagger_parser** from the NestJS OpenAPI spec.
3. Offline: drift (SQLCipher-encrypted) + outbox first; PowerSync only after a spike proves the need.
4. Custom Flutter design system in `packages/flutter_ui` generated from the shared DTCG tokens (ThemeExtension), tenant theme JSON at runtime; motion via implicit/explicit animations + Rive for a few signature moments; strict a11y and Arabic typography.
5. Quality: very_good_analysis, alchemist goldens, patrol + Maestro, Widgetbook, Sentry SDK → GlitchTip (self-hosted) with PHI scrubbing.
6. Claude Code: Flutter agent plugin + Dart MCP server + rules in CLAUDE.md + repo skills for your architecture and design system.
7. Android-first performance budget and device lab reflecting Syrian device mix; distribution plan that does not depend on a Syria-registered Play Console account.

---

## Sources (accessed 2026-11-08)
Base UI / React
- [S1] Base UI releases — https://base-ui.com/react/overview/releases
- [S2] Base UI v1.9.0 notes — https://base-ui.com/react/overview/releases/v1-9-0.md
- [S3] GitHub mui/base-ui — https://github.com/mui/base-ui
- [S4] GitHub releases — https://github.com/mui/base-ui/releases
- [S5] Base UI llms.txt (component/utility/handbook index) — https://base-ui.com/llms.txt
- [S6] About Base UI — https://base-ui.com/react/overview/about.md
- [S7] MUI "2026 and beyond" (2026-01-01) — https://mui.com/blog/2026-and-beyond/
- [S8] DirectionProvider — https://base-ui.com/react/utils/direction-provider.md
- [S9] PR #4840 RTL fixes (merged 2026-05-18) — https://github.com/mui/base-ui/pull/4840
- [S10] Popover `side` values — https://base-ui.com/react/components/popover ; secondary: https://docs.twenty.com/ui/primitives/layout/direction-provider , https://www.neobrutalism.dev/docs/direction
- [S11] Accessibility — https://base-ui.com/react/overview/accessibility.md
- [S12] Styling handbook — https://base-ui.com/react/handbook/styling.md
- [S13] Quick start — https://base-ui.com/react/overview/quick-start.md
- [S14] Next.js App Router guide — https://base-ui.com/guides/next-js-app-router
- [S15] @base-ui/react@1.9.0 package.json — https://unpkg.com/@base-ui/react@1.9.0/package.json
- [S16] depscope size listing — https://depscope.dev/pkg/npm/@base-ui/react
- [S17] Tailor date-picker implementation comparison — https://docs.tailor.tech/app-shell/proposals/date-picker-impl-comparison
- [S18] Base UI DateField deploy preview — https://deploy-preview-3666--base-ui.netlify.app/react/components/date-field
- [S19] Forms handbook — https://base-ui.com/react/handbook/forms.md
- [S20] shadcn/ui changelog — https://ui.shadcn.com/docs/changelog
- [S21] shadcn/ui RTL — https://ui.shadcn.com/docs/rtl
- [S23] React DayPicker — https://daypicker.dev/
- [S24] react-day-picker releases — https://github.com/gpbl/react-day-picker/releases
- [S25] TanStack Table v9 announcement — https://tanstack.com/blog/announcing-tanstack-table-v9 ; https://infoq.com/news/2026/07/tanstack-table-v9-beta
- [S26] cmdk package.json — https://raw.githubusercontent.com/pacocoursey/cmdk/main/cmdk/package.json
- [S47] Next.js 16 — https://nextjs.org/blog/next-16 ; secondary: https://www.achromatic.dev/changelog/september-2026-nextjs-react-update
Tokens / tooling
- [S27] DTCG 2025.10 stable — https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- [S28] Style Dictionary releases — https://github.com/style-dictionary/style-dictionary/releases
- [S29] Style Dictionary predefined formats — https://styledictionary.com/reference/hooks/formats/predefined/
- [S30] Terrazzo Tailwind integration — https://terrazzo.app/docs/integrations/tailwind/
- [S31] dtcg_theme — https://pub.dev/packages/dtcg_theme
- [S32] Figma variables DTCG export (secondary) — https://atomize.tools/blog/figma-variables-export-json/ ; https://forum.figma.com/ask-the-community-7/native-variable-export-feature-47831
- [S33] Figma extended collections — https://help.figma.com/hc/en-us/articles/36346281624471
- [S34] Tokens Studio token format — https://docs.tokens.studio/manage-settings/token-format ; https://github.com/tokens-studio/sd-transforms
- [S35] Tailwind releases — https://github.com/tailwindlabs/tailwindcss/releases ; https://tailwindcss.com/blog/tailwindcss-v4-3 ; https://laravel-news.com/tailwindcss-4-2-0
- [S36] Storybook releases — https://github.com/storybookjs/storybook/releases ; https://storybook.js.org/blog/storybook-10/
- [S37] Storybook a11y testing — https://storybook.js.org/docs/writing-tests/accessibility-testing
- [S38] Storybook MCP — https://storybook.js.org/docs/ai/mcp/overview
- [S39] Chromatic pricing — https://chromatic.com/pricing ; https://argos-ci.com/blog/visual-testing-pricing
- [S40] Lost Pixel (archived) — https://github.com/lost-pixel/lost-pixel
- [S41] Figma MCP server — https://developers.figma.com/docs/figma-mcp-server/
- [S42] Figma Code Connect — https://developers.figma.com/docs/code-connect/
- [S43] Figma MCP + Claude Code (secondary) — https://claudemarketplaces.com/mcp/figma/mcp-server-guide
- [S44] Material language support — https://m2.material.io/design/typography/language-support.html ; secondary: https://hapy.co/journal/arabic-website-design-basics/ , https://noqta.tn/blog/arabic-rtl-website-mistakes
- [S45] CLDR plural rules — https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
- [S46] Arabic default numbering — https://lists.w3.org/Archives/Public/public-i18n-archive/2017JanMar/0406.html ; https://corp.unicode.org/pipermail/cldr-users/2019-April/000918.html
- [S48] LeanCode CTO report summary — https://www.walturn.com/insights/flutter-s-evolution-insights-from-cto-report-2024
Flutter / Dart
- [S50] Flutter release notes — https://docs.flutter.dev/release/release-notes
- [S51] What's new in Flutter 3.47 — https://flutter.dev/blog/whats-new-in-flutter-3-47
- [S52] Announcing Dart 3.13 — https://dart.dev/blog/announcing-dart-3-13 ; https://dart.googlesource.com/sdk/+/stable/CHANGELOG.md
- [S53] Flutter 3.41 post (2026 schedule) — https://flutter.dev/blog/whats-new-in-flutter-3-41 ; https://www.issoh.co.jp/md/tech/12325
- [S54] Architecture guide — https://docs.flutter.dev/app-architecture/guide
- [S55] Architecture recommendations — https://docs.flutter.dev/app-architecture/recommendations
- [S56] Offline-first pattern — https://docs.flutter.dev/app-architecture/design-patterns/offline-first
- [S57] flutter_riverpod — https://pub.dev/packages/flutter_riverpod/changelog ; https://pub.dev/packages/flutter_riverpod
- [S58] Riverpod offline persistence — https://riverpod.dev/docs/concepts2/offline ; https://riverpod.dev/docs/whats_new
- [S59] Riverpod code generation — https://riverpod.dev/docs/concepts/about_code_generation
- [S60] flutter_bloc — https://pub.dev/packages/flutter_bloc
- [S61] signals — https://pub.dev/packages/signals
- [S62] provider — https://pub.dev/packages/provider
- [S63] go_router — https://pub.dev/packages/go_router
- [S64] freezed — https://pub.dev/packages/freezed
- [S65] dart_mappable — https://pub.dev/packages/dart_mappable
- [S66] retrofit — https://pub.dev/packages/retrofit
- [S67] swagger_parser — https://pub.dev/packages/swagger_parser
- [S68] openapi-generator dart-dio — https://openapi-generator.tech/docs/generators/dart-dio/
- [S69] drift — https://pub.dev/packages/drift
- [S70] powersync — https://pub.dev/packages/powersync ; https://docs.powersync.com/client-sdks/orms/flutter-orm-support
- [S71] PowerSync pricing/self-hosting/changelog — https://powersync.com/pricing ; https://docs.powersync.com/self-hosting ; https://powersync.com/blog/powersync-changelog-february-2026.md
- [S72] firebase_messaging — https://pub.dev/packages/firebase_messaging
- [S73] flutter_secure_storage — https://pub.dev/packages/flutter_secure_storage
- [S74] sentry_flutter — https://pub.dev/packages/sentry_flutter ; GlitchTip Flutter — https://glitchtip.com/sdkdocs/dart-flutter
- [S75] very_good_analysis — https://pub.dev/packages/very_good_analysis
- [S76] alchemist — https://pub.dev/packages/alchemist
- [S77] patrol — https://pub.dev/packages/patrol
- [S78] Maestro Flutter — https://docs.maestro.dev/platform-support/flutter
- [S79] melos — https://pub.dev/packages/melos ; pub workspaces — https://dart.dev/tools/pub/workspaces
- [S80] Shorebird — https://shorebird.dev/blog/1.0 ; https://docs.shorebird.dev/roadmap/
- [S81] flutter_animate — https://pub.dev/packages/flutter_animate ; rive — https://pub.dev/packages/rive ; lottie — https://pub.dev/packages/lottie
- [S82] fl_chart — https://pub.dev/packages/fl_chart
- [S83] Impeller — https://docs.flutter.dev/perf/impeller
- [S84] App size — https://docs.flutter.dev/perf/app-size ; Deferred components — https://docs.flutter.dev/perf/deferred-components
- [S85] Material/Cupertino decoupling — https://docs.flutter.dev/release/breaking-changes/material-ui-and-cupertino-ui ; https://flutter.dev/blog/decoupling-material-cupertino
- [S86] widgetbook — https://pub.dev/packages/widgetbook
- [S87] Dart & Flutter MCP server — https://docs.flutter.dev/ai/mcp-server ; https://github.com/dart-lang/ai/tree/main/pkgs/dart_mcp_server
- [S88] AI rules + agent plugins — https://docs.flutter.dev/ai/ai-rules ; https://github.com/flutter/agent-plugins
Syria
- [S89] Anadolu, Google services resume (2026-01-18) — https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701
- [S90] UnblockSyria Play Console tracker (as of 2026-10-07) — https://unblocksyria.com/en/services/google-play-console
- [S91] The New Arab, Apple/App Store return (Sep 2025) — https://www.newarab.com/news/apple-products-app-store-return-syria-amid-sanctions-lift
- [S92] StatCounter Syria — https://gs.statcounter.com/os-market-share/mobile/syrian-arab-republic ; https://gs.statcounter.com/android-version-market-share/mobile/syrian-arab-republic
