# ADR-0039: UI SDK as the headless base of `packages/ui`, with an RTL gate and a Base UI fallback; code-first design source

Status: Accepted (owner, 2026-11-20); "Agent skill" point amended by [ADR-0041](0041-ui-sdk-skill-not-vendored-agent-bridge-off.md) · Date: 2026-11-20 · Deciders: product owner (with Claude) · Amends: [ADR-0011](0011-design-system-base-ui.md)

## Context
ADR-0011 chose Base UI as the headless base of the web design system and Figma as the design source. On 2026-11-12 Vercel Labs published UI SDK (`@ui-sdk/core`, `@ui-sdk/react`), a library of interface behaviours (keyboard, focus, selection, popups, drag and drop, ARIA) with unstyled React parts, and the owner asked to re-evaluate (OD-48). Checked on 2026-11-20:

- Version `0.1.0-beta.13`; 13 betas in 8 days; the docs say "some APIs may still change"; no stable date and no breaking-change policy are published.
- Licence Apache-2.0. Needs React 19 or newer. Server rendering is documented.
- About 55 unstyled components, including ones Base UI lacks: date picker, calendar, date and time input, OTP input, tree, command, drawer, token input, file input. No data table.
- Styling through `data-slot` and state attributes (`data-open`, `data-side`), usable with Tailwind.
- RTL: arrow keys "follow the page's text direction"; direction bugs were fixed during the beta (issues 129, 130, 542). There is no written RTL guarantee and no Hijri calendar; Arabic locale formatting is shown in the date docs.
- An agent bridge (`@ui-sdk/react/agent`) lets an AI agent read components and call their actions; without an `allow` callback it accepts every supported action.

OD-48's recommendation was to stay on Base UI until a stable release. The owner chose to adopt UI SDK now, with safeguards.

## Decision
- **UI SDK is the headless base of `packages/ui`.** `@ui-sdk/react` and `@ui-sdk/core` are pinned to one exact version. Only `packages/ui` may import `@ui-sdk/*` (lint); apps and feature packages use our components, so the library underneath can change without touching screens.
- **RTL gate first.** Before the core set is built, Select, Combobox, Menu, Dialog, Popover, Tabs, Date Picker and Number Input must pass automated Arabic RTL tests (arrow keys, popup side, focus, Arabic typeahead, both digit styles, axe). The gate result is recorded in its slice file.
- **Base UI is the per-component fallback.** A component that fails the gate, or breaks later, is built on `@base-ui/react` (exact pin) behind the same `packages/ui` API and listed in the design doc with the upstream issue. It returns to UI SDK when the issue is fixed.
- **Upgrades are deliberate.** A UI SDK version change is its own PR and must pass the full RTL, accessibility and screenshot suites. The choice is reviewed when UI SDK reaches a stable release.
- **The agent bridge is not used.** Importing `@ui-sdk/react/agent` is a lint error. Enabling it on any surface, above all screens with patient data, needs its own ADR with a security review.
- **Agent skill.** The upstream `ui-sdk` skill is vendored at a pinned commit after review, for development sessions only.
- **Companions:** TanStack Table and Virtual (data tables) and React Hook Form with Zod (forms) stay. react-day-picker and react-dropzone are dropped unless the UI SDK date picker or file input fails the gate. The command palette uses UI SDK Command.
- **Design source (closes OD-19).** Tokens are edited in code; visual exploration is done in Claude Design; Storybook is the living reference. Figma and Code Connect are not used.
- **Themes (OD-56).** Light and dark ship together: every semantic colour token has both values and every component is tested in both.
- **Design language (OD-57).** Three directions on three real screens are built first; the owner's choice is recorded in the design doc before the component set is built.

Everything else in ADR-0011 stands: DTCG tokens with Style Dictionary v5 shared with Flutter, Tailwind v4 logical properties, bidi isolation, Storybook with failing accessibility checks, Playwright visual regression, locked clinical and status colours, no shadcn/ui kit.

## Consequences
+ More components from one behaviour model (date, time, OTP, tree, drawer), so fewer companion libraries.
+ The wrapper rule and the fallback keep a beta dependency from blocking a slice.
− A beta base in a medical product: behaviour can change between betas; upgrades cost a full test run, and the RTL suites are ours to maintain.
− Two headless libraries may coexist for a time, which is more to learn and to test.
− No Figma file: reviewers of the design read prototypes and Storybook, not a design tool.

## Alternatives considered
- Stay on Base UI until UI SDK is stable (OD-48's recommendation): lowest risk; rejected by the owner, who wants UI SDK's wider set now.
- UI SDK with no fallback: simpler, but one beta bug could stop a slice.
- Base UI as the base and UI SDK only for missing components: safer, but uses little of UI SDK.

## Sources
[UI SDK repository](https://github.com/vercel-labs/ui), [UI SDK docs](https://ui-sdk.dev/docs), [npm `@ui-sdk/react`](https://www.npmjs.com/package/@ui-sdk/react), all read 2026-11-20; [RN-19 §A1–§A12]; OD-19, OD-48, OD-56, OD-57.
