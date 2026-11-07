# Design system

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-17, RN-19

Shifa has its own design system, built on Base UI headless components for the web and on a matching Flutter widget library, both generated from one set of design tokens ([ADR-0011](../adr/README.md)). This document defines the token model, the component plan, RTL and typography rules, clinic theming, and how quality is checked.

## Goals

- One visual language across clinic web, admin, display, booking pages and the Flutter app.
- Arabic RTL first, dense data screens that stay readable, large touch targets for tablets at the chair.
- Clinic branding without breaking clinical meaning: clinics can change brand colours, never status or clinical colours.
- Every component documented, accessible and visually tested.

## Token model

Format: W3C Design Tokens (DTCG 2025.10). Source of truth: `packages/tokens`, edited in code (and mirrored from Figma Variables when the Figma plan allows, OD-19).

| Layer | Examples | Who may change |
|---|---|---|
| Primitive | `color.teal.600`, `space.4`, `radius.md`, `font.size.300` | Design system only |
| Semantic | `color.bg.surface`, `color.text.muted`, `color.border.focus`, `color.status.success`, `color.clinical.planned` | Design system only |
| Brand (per clinic) | `color.brand.primary`, `color.brand.on-primary` | Generated per clinic, contrast-checked |
| Component | `button.primary.bg`, `odontogram.planned.fill` | Design system only |

Pipeline: Style Dictionary v5 builds
- CSS custom properties and a Tailwind v4 theme for web packages;
- a Dart class consumed by `packages/shifa_ui` (Flutter `ThemeExtension`s);
- a drift check in CI fails if generated outputs are stale.

Clinical and status colours are locked tokens: odontogram statuses, perio thresholds, laterality chips, alert severities and queue statuses have one meaning everywhere.

## Platform colour palette — "Damascene Jasmine" (ياسمين الشام)

Chosen by the owner on 2026-11-08 from ten explored directions. It is Shifa's own palette: the default for every surface (clinic web, admin, display, booking pages, patient app) and the fallback when a clinic sets no brand colour.

Concept: the white of jasmine on Damascene courtyard walls, the deep green of its leaves and a touch of gold from carved doors. Calm, warm and trustworthy; suitable for every specialty.

The Shifa logo uses the same colours; its files and usage rules are in [brand/logo.md](../brand/logo.md).

### Primitive colours

| Token | Hex | Name (UI/brand) | Role |
|---|---|---|---|
| `color.jasmine.green.600` | `#1F6F5C` | أخضر الورق — Leaf green | Primary |
| `color.jasmine.green.800` | `#134A3D` | أخضر الليل — Night green | Primary deep |
| `color.jasmine.green.100` | `#E2F0EA` | نعناع — Mint | Primary soft |
| `color.jasmine.gold.500` | `#C8A24A` | ذهب الأبواب — Door gold | Accent |
| `color.jasmine.gold.100` | `#F7EDD3` | قشّ — Straw | Accent soft |
| `color.jasmine.cream.50` | `#FBF8F1` | ياسمين — Jasmine | App background |
| `color.jasmine.cream.200` | `#F4EFE3` | — | Raised / secondary surface |
| `color.jasmine.cream.300` | `#E6DFCF` | — | Borders and dividers |
| `color.jasmine.ink.900` | `#1D2A26` | حبر زيتي — Olive ink | Main text |
| `color.jasmine.ink.500` | `#5B6A63` | — | Muted text |
| `color.white` | `#FFFFFF` | — | Cards, on-primary text |

### Semantic mapping (light mode)

| Semantic token | Value |
|---|---|
| `color.bg.app` | `cream.50` `#FBF8F1` |
| `color.bg.surface` | `white` `#FFFFFF` |
| `color.bg.surface-raised` | `cream.200` `#F4EFE3` |
| `color.border.default` | `cream.300` `#E6DFCF` |
| `color.text.default` | `ink.900` `#1D2A26` |
| `color.text.muted` | `ink.500` `#5B6A63` |
| `color.brand.primary` | `green.600` `#1F6F5C` |
| `color.brand.primary-hover` / `-pressed` | `green.800` `#134A3D` |
| `color.brand.on-primary` | `white` `#FFFFFF` |
| `color.brand.primary-soft` | `green.100` `#E2F0EA` (selected rows, current-number card, chips) |
| `color.brand.accent` | `gold.500` `#C8A24A` (logo mark, highlighted numbers, active-nav indicator) |
| `color.brand.accent-soft` | `gold.100` `#F7EDD3` (avatars, soft highlights) |
| `color.nav.bg` / `color.nav.text` | `green.800` `#134A3D` / `#E8F2EE` (clinic sidebar) |
| `color.border.focus` | `green.600` `#1F6F5C` |

Approximate usage weight: about 70 % jasmine and white surfaces, 20 % green (actions, navigation, current state), under 10 % gold.

### Contrast (WCAG 2.2)

| Pair | Ratio | Result |
|---|---|---|
| Text `#1D2A26` on background `#FBF8F1` | 14.0 : 1 | AAA |
| White on primary `#1F6F5C` | 6.0 : 1 | AA |
| Primary `#1F6F5C` on background `#FBF8F1` | 5.7 : 1 | AA |
| Primary `#1F6F5C` on mint `#E2F0EA` | 5.1 : 1 | AA |
| Nav text `#E8F2EE` on night green `#134A3D` | 8.9 : 1 | AAA |
| Muted `#5B6A63` on surfaces (white → `#F4EFE3`) | 5.7–5.0 : 1 | AA |
| Text `#1D2A26` on gold `#C8A24A` | 6.2 : 1 | AA |
| Gold `#C8A24A` on white | 2.4 : 1 | Fails — never use gold for text on light surfaces |
| Gold `#C8A24A` on night green `#134A3D` | 4.2 : 1 | Large text and marks only |

Rules: gold is a fill, border or mark colour, with `ink.900` text on top; it is never body text. The muted text was darkened from the exploration value `#6B7A73` to `#5B6A63` so it passes AA on every surface.

### Boundaries

- The palette covers brand and neutral colours only. Clinical and status colours (alert severities, queue statuses, odontogram statuses, laterality, pain types) stay locked tokens with their own definitions and are never taken from this palette; red is reserved for clinical alerts.
- A clinic brand colour replaces `color.brand.*` for that clinic only; neutrals and clinical tokens stay as defined here.
- Dark mode (for evening clinics and the waiting-room display) is not defined yet; it will be derived from this palette in Phase 0.4.

## Clinic theming

- The clinic picks a brand colour and uploads a logo; the server computes the brand palette (tints, on-colours), checks WCAG contrast against surfaces, and serves it to web and Flutter.
- Brand tokens apply to chrome (header, primary actions, booking page); they never override semantic or clinical tokens.
- Print templates (A5 prescription, receipts, reports) use the clinic letterhead with fixed layout options ([platform-and-configuration](../domain/platform-and-configuration.md)).

## Web components

- `packages/ui` wraps Base UI (`@base-ui/react`, pinned to an exact version; minor releases have changed behaviour) [RN-19].
- Styling with Tailwind v4 logical utilities (`ms-*`, `pe-*`, `start-*`) only; physical left/right utilities are lint errors.
- Core set (Phase 0.4): button, icon button, input, textarea, number field, select, combobox, checkbox, radio, switch, field/form, dialog, alert dialog, popover, menu, tooltip, tabs, accordion, toast, avatar, badge, card, toolbar, pagination, skeleton, empty state.
- Companions where Base UI has gaps:

| Need | Choice |
|---|---|
| Date / time picking | react-day-picker (Arabic locale, optional Hijri display) |
| Data tables | TanStack Table + TanStack Virtual |
| Forms | React Hook Form + Zod (shared schemas) |
| File upload | react-dropzone (plus resumable upload for imaging) |
| Command palette | Built on Base UI menu/combobox |

- Clinical widgets (odontogram, perio grid, skeleton/body chart) are custom SVG components in their domain packages, using the same tokens; they must also print correctly ([dental](../domain/dental.md), [orthopedics](../domain/orthopedics.md)).

## RTL and typography

- Set `dir="rtl"` and `lang="ar"` on the document and wrap the app in Base UI's `DirectionProvider` (the provider alone does not set `dir`) [RN-19].
- Use logical sides for floating elements (`inline-start` / `inline-end`); test keyboard navigation in RTL for every interactive component (RTL keyboard fixes were still landing in 2026).
- Wrap Latin fragments inside Arabic text (drug names, units, IDs, phone numbers, tooth numbers) in isolated spans so they render in the correct direction.
- Fonts: IBM Plex Sans Arabic for UI, Noto Naskh Arabic for long text and print, self-hosted and subsetted (licences to confirm). Type scale tuned for Arabic x-height; minimum 14 px for data, 16 px for body text.
- Digits: Western or Arabic-Indic per clinic setting (OD-20); dates and currency through i18next/ICU with explicit numbering system.

## Flutter design system

- `packages/shifa_ui`: theme extensions generated from the same tokens, plus Shifa widgets (buttons, fields, cards, queue position card, doctor card, appointment card, record items).
- Built on Flutter's own widgets, not on Material defaults (Material/Cupertino became separate packages in Flutter 3.47) [RN-19].
- Motion: a small set of signature animations in Rive (queue progress, "you are called", booking confirmation); everything else uses implicit animations; respect reduced-motion settings.
- Performance budget for low-end Android: 60 fps scrolling on a 2–3 GB RAM device; image and animation sizes checked in CI where possible.

## Quality checks

- Storybook (pinned major) documents every web component with RTL and LTR stories, states and accessibility notes.
- Accessibility: axe checks in Storybook test runs fail the build.
- Visual regression: Playwright screenshots in Docker (or Chromatic if budget allows); Lost Pixel is archived and not used.
- Flutter: golden tests (alchemist) for `shifa_ui` widgets in RTL; widget previews for development.
- Contract: tokens drift check; no hard-coded colours, spacing or fonts outside `packages/tokens` (lint rule).

## Working with Claude Code

- The `/ui-component` skill holds the component checklist (API conventions, RTL, a11y, stories, tests) and points to the best existing component to copy.
- Figma MCP gives sessions access to designs; Code Connect for React and Flutter needs the Organization plan (OD-19).

## Effort and risks

- Estimated 4.5–6.5 person-months for the first complete version (vs 1–2 for re-skinning a ready-made kit) [RN-19]; Phase 0.4 delivers the core set, the rest grows with features.
- Risks: behaviour changes in Base UI minor releases (pin and test), RTL edge cases (test every component), complex widgets (date/time, tables, charts) taking longer than planned.
