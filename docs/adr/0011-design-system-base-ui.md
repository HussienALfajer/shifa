# ADR-0011: Custom design system on Base UI with DTCG tokens shared with Flutter (no shadcn/ui)

Status: Accepted · Date: 2026-11-08 · Deciders: product owner

## Context
The owner wants Shifa's own professional UI/UX identity rather than a re-skinned kit. Base UI (MUI/Radix team) is headless, MIT-licensed, stable since v1.0.0 (2025-12-11), latest v1.9.0 (2026-10-09), 37 components plus `DirectionProvider` [RN-19 §A1–§A3]. The web apps and the Flutter app must look like one product.

## Decision
- `packages/tokens`: single source of design tokens in the W3C DTCG format (2025.10), layered primitive → semantic → component; Style Dictionary v5 generates CSS variables, the Tailwind v4 theme and a Dart theme for Flutter; a drift check fails CI if outputs are stale.
- `packages/ui`: our component library built on `@base-ui/react`, pinned to an exact version. Companions where Base UI has gaps: react-day-picker (calendar), TanStack Table/Virtual (data tables), React Hook Form (forms), react-dropzone (upload); command palette built on Base UI menus.
- RTL first: set `dir` on the document as well as `DirectionProvider`; CSS logical properties only (lint); popups use logical sides; heavy keyboard testing in RTL because RTL keyboard fixes were still landing in 2026.
- Bidi isolation for Latin fragments inside Arabic text (drug names, units, IDs, phone numbers).
- Storybook 10 documents every component; accessibility checks fail the build; visual regression with Playwright screenshots in Docker (or Chromatic). Lost Pixel is not used (archived 2026-04-22).
- Tenant branding (logo, primary colour) is computed server-side into a palette with contrast checks and served to web and Flutter; status and clinical colours are locked and cannot be rebranded.
- Figma is the design source; Code Connect for both React and Flutter needs the Organization plan (OD-19).

## Consequences
+ Full ownership of look, behaviour and RTL quality; one identity across web and mobile.
− Estimated 4.5–6.5 person-months for v1 of the system versus 1–2 months to re-skin a kit [RN-19 §A10]; minor Base UI releases can change behaviour, so upgrades are deliberate.

## Alternatives considered
- shadcn/ui on Base UI or Radix (recommended earlier): faster start, RTL support since 2026-01; rejected by the owner for identity and code ownership. Note that shadcn's default primitives are now Base UI, so the underlying technology is the same [RN-19 §A9].
- Ant Design 6, Mantine, MUI: opinionated look, harder to make distinctive.

## Sources
[RN-19 §A1–§A12], [RN-17 §3], [RN-21 §5]
