# Design system

Status: Draft · Last updated: 2026-11-23 · Owner: product owner
Sources: RN-17, RN-19

Shifa has its own design system, built on UI SDK headless behaviours for the web (Base UI as per-component fallback) and on a matching Flutter widget library, both generated from one set of design tokens ([ADR-0011 and ADR-0039](../adr/README.md)). Phase 0.4 builds it from [spec 0.4](../specs/design-system/0.4-design-system-foundations.md). This document defines the token model, the component plan, RTL and typography rules, clinic theming, and how quality is checked.

## Goals

- One visual language across clinic web, admin, display, booking pages and the Flutter app.
- Arabic RTL first, dense data screens that stay readable, large touch targets for tablets at the chair.
- Clinic branding without breaking clinical meaning: clinics can change brand colours, never status or clinical colours.
- Every component documented, accessible and visually tested.

## Token model

Format: W3C Design Tokens (DTCG 2025.10). Source of truth: `packages/tokens`, edited in code. Figma is not used (OD-19 closed). Designs are made first in the Shifa design project in Claude, which mirrors the code ([Design workflow](#design-workflow)); Storybook is the technical reference for components.

| Layer | Examples | Who may change |
|---|---|---|
| Primitive | `color.teal.600`, `space.4`, `radius.md`, `font.size.300` | Design system only |
| Semantic | `color.bg.surface`, `color.text.muted`, `color.border.focus`, `color.status.success`, `color.clinical.planned` | Design system only |
| Brand (per clinic) | `color.brand.primary`, `color.brand.on-primary` | Generated per clinic, contrast-checked |
| Component | `button.primary.bg`, `odontogram.planned.fill` | Design system only |

Pipeline (built in slice 0.4-01): Style Dictionary v5 builds
- CSS custom properties (`--shifa-*`: light on `:root`, then what changes under `[data-theme='dark']` and `[data-density='compact']`) and a Tailwind v4 theme for web packages;
- Dart constants consumed by `packages/shifa_ui` (both themes, both densities; `ShifaThemeData` wraps them, slice 0.4-08; no Material `ThemeExtension`);
- the Shifa Design System's tokens file (`packages/tokens/generated/design-system/tokens.json`, the Design System artifact type's list format, names = the CSS custom properties; slice 0.4-02b, ADR-0040);
- the `tokens` drift check of `verify` fails if generated outputs are stale.

Rules the schema test enforces (details in `packages/tokens/CLAUDE.md`):
- A primitive holds a literal; a semantic or brand token references a primitive; a component token references a semantic or brand token.
- Modes: every semantic and brand colour has a light and a dark value; sizes that differ between the two densities have a compact value.
- Tailwind is given semantic and brand colours only, so a utility class cannot name a palette step; shadows only by job.
- Every semantic and brand token has a usage note (`$description` on it or on a group above it, not at the top of a file); the design system shows it.

Clinical and status colours are locked tokens: odontogram statuses, perio thresholds, laterality chips, alert severities and queue statuses have one meaning everywhere.

Locked set today (hues from `color.signal.*`, apart from the brand palette):

| Group | Members | Parts |
|---|---|---|
| `color.status` | success (green), warning (amber), danger (brick), info (blue), neutral (slate) | fg, bg, border, solid, on-solid |
| `color.sync` | saved (green), offline (slate), syncing (blue) | fg, bg |
| `color.alert` | info (blue), warning (amber), critical (crimson) | fg, bg, border, solid, on-solid |
| `color.queue` (SCH-18) | booked (slate), confirmed (blue), arrived (cyan), waiting (amber), in-room (violet), done (green), no-show (brick), cancelled (sand) | fg, bg |

Crimson is the only red and belongs to `color.alert.critical` (principle 1 of spec 0.4), so `danger` (destructive actions, validation errors) is brick. The three alert severity names and the hue of each status were confirmed by the owner on 2026-11-20 (slice 0.4-02b). Odontogram, perio, laterality and pain colours join under `color.clinical` with their modules (Phases B–C, spike S8).

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

Contrast is declared, not guessed: `packages/tokens/src/contrast-pairs.json` lists each text or icon colour with a surface it is drawn on and its class (`body` 4.5 : 1; `large` and `ui` 3 : 1). The contrast test computes every pair in light and in dark and fails the build below the minimum; a text or icon colour that is in no pair fails the schema test. A clinic brand palette (PLT-41) must meet the pairs declared for the `color.brand.*` slots.

### Dark theme (OD-56)

Derived from the same palette in slice 0.4-01; shown on the direction screens of slice 0.4-02; drawn again, side by side with light, in the Shifa Guide (slice 0.4-02b). Confirmed by the owner on 2026-11-20 after comparing it with four alternatives on the reception queue screen (warm brown-charcoal, deep teal, neutral graphite, a lighter dim night): the current "night jasmine" values below stay. Steps added to the palette for it: `night` 950–700, `ink` 100, 300 and 400, `green` 200, 300, 900 and 950, `gold` 400 and 900.

| Semantic token | Dark value |
|---|---|
| `color.bg.app` | `night.950` `#0E1513` |
| `color.bg.surface` | `night.900` `#151E1B` |
| `color.bg.surface-raised` | `night.800` `#1C2824` |
| `color.border.default` | `night.700` `#2B3934` |
| `color.border.strong` (light and dark) | `ink.400` `#76857E` (3 : 1 on every surface, for input outlines) |
| `color.text.default` | `ink.100` `#E6EDE9` |
| `color.text.muted` | `ink.300` `#A3B2AB` |
| `color.brand.primary` / `color.border.focus` | `green.300` `#6FC3AB` |
| `color.brand.primary-hover` / `-pressed` | `green.200` `#9AD8C5` |
| `color.brand.on-primary` / `color.brand.on-accent` | `night.950` `#0E1513` |
| `color.brand.primary-soft` | `green.900` `#12382F` |
| `color.brand.accent` | `gold.400` `#D4B463` |
| `color.brand.accent-soft` | `gold.900` `#3A2F14` |
| `color.nav.bg` / `color.nav.text` | `green.950` `#0C2A23` / `green.50` `#E8F2EE` |

Status colours in dark use the 300 step for text, 900 for the soft fill, 800 for the border and 400 for the solid fill with `night.950` text on it.

### Boundaries

- The palette covers brand and neutral colours only. Clinical and status colours (alert severities, queue statuses, odontogram statuses, laterality, pain types) stay locked tokens with their own definitions and are never taken from this palette; red is reserved for clinical alerts.
- A clinic brand colour replaces `color.brand.*` for that clinic only; neutrals and clinical tokens stay as defined here.
- Dark mode (for evening clinics and the waiting-room display) ships with light mode: every semantic colour token has both values (table above) and every component is tested in both (OD-56).
- The design language beyond colour (type scale, shape, elevation, density, motion, icon style) is the Warm direction, chosen by the owner in slice 0.4-02 (OD-57); see [Design language](#design-language--warm-الدافئ).

## Design language — Warm (الدافئ)

Chosen by the owner on 2026-11-20 from four directions drawn on the same three screens (reception queue, doctor visit on desktop and tablet, patient booking): A Precise, B Calm, C Warm, D Courtyard. The briefs are in `design/directions/briefs/`; the research behind them (clinical design systems, Arabic UI fonts, RTL practice) is summarised in [slice 0.4-02](../slices/0.4-02-design-directions-and-fonts.md).

Idea: a welcoming place. Generous cards, rounder shapes, larger text and a little gold, so the patient app feels kind and the clinic screens feel human; tempered by public-service plainness: big text, obvious buttons, nothing clever.

| Item | Value | Tokens |
|---|---|---|
| Radius | 4 marks, 8 inputs and chips, 12 buttons and cards, 16 dialogs and sheets, full for status pills and number badges | `radius.xs`–`lg`, `shape.radius.*` |
| Surfaces | white cards on cream with a light border and one small soft shadow (0 1 px 2 px, 8 %); dropdowns one level higher, dialogs one more; no blur, no large shadow. In dark the border carries the card | `elevation.1`–`3`, `shadow.card`, `.dropdown`, `.modal` |
| Type | ratio 1.25 from 16 px: data 15 (compact 14), body 16 (phone and reading 18), headings 20, 25, 31, display numbers 44; line height 1.6 body, 1.3 headings, 1.8 reading; weights 400 body, 500 labels, 600 headings, 700 display numbers | `font.size.*`, `text.size.*`, `text.weight.*` |
| Density | comfortable: 44 px controls (the prototype drew 48; the tokens keep 44 with 52 for large), 48 px rows, card rows with 8 px gaps; compact (pointer devices only): 32 px controls and ruled rows, at least ten queue rows at 1366 × 768 | `size.control.*`, `size.row` |
| Icons | Solar by 480 Design (CC BY 4.0, credited with the icons, and on each app's About screen when that screen is built), Broken style: one round 1.5 px stroke with deliberate gaps on a 24 grid, no fill, no second tone; 20 px in rows and controls and 24 px in navigation and cards; medical glyphs from Solar, the tooth from Healthicons (CC0). Ink is the text colour: near-black in light, light in dark, greyed inside a disabled control (OD-65, replacing Phosphor duotone). Mirror only directional icons | `size.icon.*`, `color.icon.*` |
| Motion | 150 ms hover and press, 200 ms popovers, 240 ms dialogs and sheets; ease-out, 8 px rise; off under reduced motion | `motion.duration.*`, `motion.easing.*` |
| Numerals | Western digits, tabular; the queue number at 44 px, weight 700, in a round badge | `text.size.display`, `text.weight.display` |
| Ornament | a small jasmine or eight-point star drawing in empty states only | — |

Rules that come with it:
- The patient in the room is one large card with a wide primary button; nothing else on the screen competes with it.
- Status is a rounded pill with a filled icon and a word; colour is the third cue.
- Light is the default theme; dark is a user choice and the waiting-room display's default.
- Compact density is for pointer devices; the tablet and the phone stay comfortable.

Filled in slice 0.4-02b: named type styles (`text.style.title.*`, `.label.*`, `.paragraph.*`), the focus halo (`elevation.focus`, `shadow.focus`, outside the 2 px `color.border.focus` outline), icon colours (`color.icon.default`, `.muted`; both the text colour since OD-65, and the duotone `color.icon-tone.*` tones retired in slice 0.4-09), `color.text.disabled`, the overlay scrim (`color.bg.overlay`), a selection tint scale (`color.selection.subtle`, `.default`, `.strong`) and a six-hue avatar palette (`color.avatar.*`, never red). Every semantic and brand token carries a usage note, which the Shifa Design System shows. The status hues and alert severity names were confirmed by the owner on 2026-11-20: `danger` is brick, the clinical alerts are `info`/`warning`/`critical` with crimson for `critical` only, and `done`/`success`/`saved` share green.

## Clinic theming

- The clinic picks a brand colour and uploads a logo; the server computes the brand palette (tints, on-colours), checks WCAG contrast against surfaces, and serves it to web and Flutter.
- Brand tokens apply to chrome (header, primary actions, booking page); they never override semantic or clinical tokens.
- Print templates (A5 prescription, receipts, reports) use the clinic letterhead with fixed layout options ([platform-and-configuration](../domain/platform-and-configuration.md)).

## Web components

- `packages/ui` wraps UI SDK (`@ui-sdk/react` and `@ui-sdk/core`, a beta when adopted, pinned to an exact version; ADR-0039). Only `packages/ui` imports `@ui-sdk/*`. Eight components pass an Arabic RTL gate before the core set is built; a component that fails is built on Base UI (`@base-ui/react`, exact pin) behind the same API and listed here with the upstream issue. The UI SDK agent bridge is not used.
- **RTL gate result (slice 0.4-04, 2026-11-20, UI SDK 0.1.0-beta.13):** Tabs, Dialog, Popover, Menu, Select, Combobox, Number Input and Date Picker all pass in Arabic RTL and English LTR, so the set stays on UI SDK (the results table is in the slice file). Four checks passed after a fix inside `packages/ui`, which the next components reuse:
  - typed Arabic-Indic digits are turned into Western ones before UI SDK's number and date fields see them (`useWesternDigits`; UI SDK accepts them only in a locale that also shows them);
  - Number Input's control gets `role=spinbutton`;
  - Combobox renders only the matching names (UI SDK hides the others) and its list is placed against the whole field.
  Dates and numbers use `ar-SY-u-nu-latn` (Levantine month names, Western digits) and `en-GB`, the week from Saturday (OD-61).
- **Base UI fallbacks:** none.
- Styling with Tailwind v4 logical utilities (`ms-*`, `pe-*`, `start-*`) only; physical left/right utilities are lint errors.
- Lint (`tooling/eslint-config/rules/`, plugin `shifa`, every package): `no-physical-direction` (physical utilities in class lists, physical properties in `style`), `no-hardcoded-design-values` (arbitrary values other than a token reference, spacing steps the tokens do not offer, literal colours, lengths and fonts in `style`), `ui-sdk-only-in-ui` (`@ui-sdk/*` and Base UI outside `packages/ui`), `no-ui-sdk-agent` (`@ui-sdk/react/agent` anywhere). Class lists are read from `className`, `cn`/`clsx`/`twMerge` and `cva`/`tv`.
- The Tailwind theme offers token values only: Tailwind's colours, spacing (with its multiplier), radius, shadows, fonts, sizes and easings are reset, so `p-14` or `bg-red-500` compile to nothing.
- `DensityProvider` refuses `compact` on a coarse pointer (`(pointer: coarse)`) and falls back to comfortable with a development warning.
- Icons: one `Icon` component over a curated list (`packages/ui/src/icons/icon.tsx`; names mapped to Solar's in `sources.ts`): Solar Broken sources vendored by `icons:sync` from `@iconify-json/solar` (exact dev pin) into a generated plain module (`src/icons/generated/icons.ts`, so any bundler loads the package) and checked against it by a test, plus the Healthicons tooth; stroke in `currentColor` (slice 0.4-09, OD-65). Control glyphs (check, x, plus, minus) are Solar's plain forms; `sign-out` is `logout-2` flipped to point to the end. Arrows, carets and sign-out mirror in RTL; nothing else does. The Flutter `ShifaGlyph` painters are generated from the same Solar paths (`shifa_ui/lib/src/generated/glyphs.g.dart`), so Flutter needs no SVG package.
- Storybook (`packages/ui/.storybook`) renders every story in the eight combinations of direction × theme × density, with the text states (long Arabic label, mixed direction, 200 % zoom, reduced motion) and axe on every story. Test helpers for the RTL gate live in `packages/ui/test/support/`.
- **UI SDK upgrade rule** (ADR-0039): UI SDK is a beta, so an upgrade of `@ui-sdk/react` and `@ui-sdk/core` (always together, to one exact version at least 24 hours old) is its own PR, with nothing else in it. That PR runs the whole `ui` part of `verify` (component tests, the RTL gate, every story with axe, the screenshots) and fixes or explains every difference; its body lists the upstream changes read (release notes and the changed components). A component whose behaviour breaks moves to Base UI behind the same API, as for the gate. The same PR re-reads the upstream `ui-sdk` skill at the new version's commit and updates `.claude/skills/ui-component/references/ui-sdk.md`, which is not a vendored copy (ADR-0041). The agent bridge stays off; ADR-0041 lists the conditions for any later use.
- Browser checks and screenshots: `docs/process/ui-screenshots.md`.
- Button (0.4-03, sheet approved 2026-11-20): primary, secondary (default), ghost, danger; sm, md, lg; the icon on the logical start; loading keeps focus and its label; the focus ring does not animate.
- Core set (Phase 0.4): listed in spec 0.4, criterion 8.
- Companions where UI SDK has gaps:

| Need | Choice |
|---|---|
| Date / time picking | UI SDK Date Picker and Time Input (Gregorian, Arabic locale); react-day-picker only if the gate fails |
| Data tables | TanStack Table v9 + TanStack Virtual (`DataTable`, slice 0.4-07; no TanStack type in the public API) |
| Forms | React Hook Form + Zod (shared schemas) |
| File upload | UI SDK File Input (plus resumable upload for imaging) |
| Command palette | UI SDK Command |

- **Data table keyboard model** (slice 0.4-07, the APG data grid pattern): `role="grid"` with one Tab stop, a roving `tabindex` on the active cell (the header is row 0). The arrows move the active cell in the reading direction (Left is the next column in Arabic) and stop at the edges; Home and End reach the row's first and last cell, Ctrl+Home and Ctrl+End the table's; PageUp and PageDown move by the rows that fit in the scroll box. Space selects the row (select-all on the header cell, `aria-checked="mixed"` when some rows are selected). Enter sorts on a sortable header (`aria-sort` on the column header), goes into a link or button inside a cell (Escape returns to the cell; such controls are kept out of the Tab order), and otherwise runs the row action, as a press on the row does. Rows are virtualised; the active row is always kept drawn, so focus survives scrolling it out of view and back; `aria-rowcount` counts every row with the header and each row carries `aria-rowindex`. The columns menu sits under the table, after the grid in the Tab order.
- **Narrow widths** (slice 0.4-12, OD-66): a data-table header never widens its column; a cut header ends in an ellipsis and shows its full text in a tooltip (500 ms on hover, at once on keyboard focus), its accessible name unchanged. Pagination fills its container and picks its form from that width (a container query at 430 px, `--container-pagination`): below it «الصفحة 3 من 13» between the arrows and the summary on a second line, at or above it the page numbers; `form` still forces one; the rows-per-page select is `size.control.select-narrow` (88 px, 76 px compact). A toolbar label stays on one line up to `size.toolbar-label` (150 px), cut with a tooltip. The tooltip of a cut header or label names its trigger (`type="label"`), so the name is said once; the label takes its own direction (`dir="auto"`), so the ellipsis ends Arabic and English text alike. `useOverflow` (`src/lib/use-overflow.ts`) tells when a text is cut.
- **Arabic search** (slice 0.4-12, OD-40): Combobox, Select's typeahead and the command palette match through one function, `foldArabic` (`src/lib/fold-arabic.ts`): OD-40's rules without whitespace collapsing and particle joining, so a match is marked in place. Combobox announces its result count with Arabic plural forms in RTL and English in LTR (UI SDK's `announcement`, no second live region). Select hands UI SDK's typeahead folded labels and folds the typed key in a capture-phase handler, because UI SDK's own folding keeps hamza forms apart.
- **Browser autocomplete** (slice 0.4-12, OD-67): `Input`, `Textarea`, `NumberInput`, `DatePicker` and `FormField` set `autocomplete="off"` by default, so a shared clinic computer never offers one patient's details while another's are typed. A field opts in with an explicit token (`name`, `tel`, `bday`…) only on the patient's own booking forms (`FormField autoComplete`, passed to its text control by context). `PasswordInput` (`current-password`, `new-password`) and `OtpInput` (`one-time-code`) keep their tokens.
- **Date and time choosers** (slice 0.4-13, OD-68 to OD-73):
  - Date Picker's typed date is three spinbuttons day / month / year, left to right in both directions, on our own small model (`date-fields.ts`), not UI SDK's `DateInput`, which passed the RTL gate but moves 31/02 to 28/02 without a word (OD-72; the gate test stays as the record). Arabic errors are shown on leaving the field or at once for an impossible date; a two-digit year is never guessed. A complete date is confirmed in the hint line with its weekday and Levantine month (`showAge` adds the age). Segments and calendar share one value and the calendar's month.
  - The calendar's heading is a button that opens a month and year panel in the same popup: a year Listbox (UI SDK) beside a 3 × 4 month grid; Escape steps back without closing the popup. The year range follows `min`/`max` (both: min's year to max's; only min: to today + 10; only max: from max − 120; neither: 1900 to today + 10).
  - Time Input's clock is a button opening the clinic's slots (UI SDK Popover): every `step` minutes (15 by default; it must divide 60), from `min` up to, not including, `max`, grouped ليلاً 00–06, صباحاً 06–12, بعد الظهر 12–17, مساءً 17–24 (OD-73), one grid per group with one tab stop; a choice goes through UI SDK's Time Input controller, so it reports like typing.
  - UI SDK controls join the nearest UI SDK Field (Listbox, a popover trigger, `useFieldControl`): a control inside another control's popup sits in a Field of its own, and a group that reads `useFieldControl().props()` keeps the ref it returns (without it the Field labels the first input it finds).
- **Builds** (slice 0.4-12, P-N2): UI SDK keeps a development history (a devtools hook and the `__UI_SDK__` global) when its `development` export condition is resolved. Every build that leaves a developer's machine, staging included, runs in production mode: never with `NODE_ENV=development`. The design-system bundle pins `mode: 'production'` and the `production` condition, and `test/design-system-bundle.test.ts` refuses a bundle with either marker; each app's production build gets the same check in its first slice.
- Clinical widgets (odontogram, perio grid, skeleton/body chart) are custom SVG components in their domain packages, using the same tokens; they must also print correctly ([dental](../domain/dental.md), [orthopedics](../domain/orthopedics.md)).

## RTL and typography

- Set `dir="rtl"` and `lang="ar"` on the document; UI SDK reads the page's text direction (a Base UI fallback component also needs Base UI's `DirectionProvider`) [RN-19].
- Use logical sides for floating elements (`inline-start` / `inline-end`); test keyboard navigation in RTL for every interactive component (RTL keyboard fixes were still landing in 2026).
- Wrap Latin fragments inside Arabic text (drug names, units, IDs, phone numbers, tooth numbers) in isolated spans so they render in the correct direction.
- Fonts: IBM Plex Sans Arabic for UI, Noto Naskh Arabic for long text and print, self-hosted and subsetted (both OFL 1.1). Files, subsets and licences are in `packages/tokens/fonts/` (`fonts.json`, `fonts.css`; built by `scripts/fonts-subset.mjs`). The OFL of IBM Plex Sans Arabic reserves the name "Plex" and a subset is a Modified Version, so its web subsets are renamed **Shifa Sans Arabic** inside the font and in the CSS and tokens; the copyright and licence notices and `OFL.txt` are kept (OD-59, slice 0.4-03). The static TTFs are the unmodified upstream files. Type scale tuned for Arabic x-height; minimum 14 px for data, 16 px for body text (15 px in compact); Naskh from 18 px up.
- Digits: Western (0–9) only, everywhere (OD-20, closed 2026-11-20); dates and currency through i18next/ICU with the numbering system set to `latn`. Inputs accept typed Arabic-Indic digits and store Western ones. Numbers in tables and queue numbers use the UI font's digits, which are tabular.

## Flutter design system

- `packages/shifa_ui`: the theme generated from the same tokens, plus Shifa widgets (buttons, fields, cards, queue position card, doctor card, appointment card, record items).
- Built on Flutter's own widgets, not on Material defaults (Material/Cupertino became separate packages in Flutter 3.47) [RN-19]. The theme is `ShifaTheme` / `ShifaThemeData` (light and dark: colours, locked status colours, type, spacing, shapes, motion), read with `context.shifa`; there is no Material `ThemeData` (slice 0.4-08).
- **Ships now (0.4-08):** `ShifaButton` (primary, secondary, ghost, danger; loading), `ShifaTextField` (Arabic-Indic digits typed are stored Western), `ShifaCard`, `ShifaChip`, `ShifaListItem`, `ShifaAppBar` with `ShifaIconButton`, `ShifaBottomSheet` (`showShifaBottomSheet`), `ShifaSnackbar` (`ShifaSnackbarHost`), with `ShifaSpinner` (the jasmine petals) and `ShifaGlyph`; the fonts (Shifa Sans Arabic, Noto Naskh Arabic) and their OFL. Touch targets 48 dp, text to 200 %, alchemist goldens in RTL, light and dark. The approved phone sheet is the visual reference.
- **Waits for Phase A (the patient app):** queue position card, doctor card, appointment card, record items, Rive animations, a text selection toolbar for `ShifaTextField` (copy and paste), and the clinic palette at runtime.
- Motion: a small set of signature animations in Rive (queue progress, "you are called", booking confirmation); everything else uses implicit animations; respect reduced-motion settings.
- Performance budget for low-end Android: 60 fps scrolling on a 2–3 GB RAM device; image and animation sizes checked in CI where possible.

## Quality checks

- Storybook (pinned major) documents every web component with RTL and LTR stories, states and accessibility notes.
- Accessibility: axe checks in Storybook test runs fail the build.
- Visual regression: Playwright screenshots in Docker (or Chromatic if budget allows); Lost Pixel is archived and not used.
- Flutter: golden tests (alchemist) for `shifa_ui` widgets in RTL; widget previews for development.
- Contract: tokens drift check; no hard-coded colours, spacing or fonts outside `packages/tokens` (lint rule).

## Design workflow

Decided in [ADR-0040](../adr/0040-design-first-in-claude-design-code-as-source.md) (OD-58). Every component and every screen is designed and approved by the owner before it is coded, in one design project in Claude; the code stays the source of truth and the project mirrors it.

### The Shifa design project

| Part | Type | Holds | Changed by |
|---|---|---|---|
| Shifa Design System | Design System, synced from code (read-only); not the account's default (that setting covers every project on the account), so sessions name it | Brand book, tokens in both themes, type, spacing, radius, shadows, fonts, logo and icons, the components of `packages/ui` with live previews and guidelines | The repository only: token output and the producer (`pnpm design-system:build`, then a publish, `docs/process/ui-screenshots.md`) |
| Shifa Guide | Design canvas | One guide page drawn from the tokens: the layer flow, then 01 Foundations, 02 Theme, 03 Tokens, 04 Effects, 05 Typography, 06 Rules | Redrawn after a token change |
| Shifa Components (proposals) | Design canvas, one page per batch | The sheet of a component batch before it is coded | The session with the owner |
| Shifa Screens | One Design canvas per app (clinic web, admin, display, booking pages, patient app), one page per module | Screens, assembled from the design system's components | The session with the owner |

The layers of the guide are the token layers: Foundations = primitive, Theme = brand, Tokens = semantic, Layers = component. Artifacts are private to the owner's account; their links are not committed here.

### Designing in the project

Every new design for Shifa (a component sheet, a screen, a prototype, a deck) follows these steps, in any session:
1. **Use the Shifa Design System.** Find it by name among the account's Design System artifacts (it is not the account default, so name it), read its `project/README.md` first, and install it on the canvas so its tokens, type styles, fonts and (from 0.4-03) components are the ones drawn with. Never another design system, a look-alike or an own palette.
2. **Keep the Shifa Guide's rules** (06 Rules, the README's usage rules): meanings not palette steps; status never by colour alone; red for critical clinical alerts only; locked colours never themed; contrast in light and dark; Arabic RTL first with Western digits; synthetic data only.
3. **Missing value or component:** do not invent a one-off on the canvas. A missing token is added in `packages/tokens`, regenerated and synced first. A missing component found by a UI batch is drawn in that batch from the system's tokens and real components: on its own sheet with every state and at once on every screen that needs it; the owner approves it or asks for changes; then it is built in `packages/ui` with `/ui-component` and synced before the screens' code uses it (ADR-0046).
5. **Use the whole API.** A screen batch uses every route, response field and error its API gives, or names why one is not shown; missing or unprofessional API answers are reported to the owner and fixed in the API (ADR-0046).
4. **Exploration outside the system** (for example comparing palettes) is allowed only on a separate canvas, never inside the Shifa Design System, and the owner's choice then goes into code first.

### Direction of flow

```
packages/tokens ──generate──▶ design-system tokens ──sync──▶ Shifa Design System ──▶ Guide, sheets, screens
packages/ui (tested) ──design-system:build + publish──▶ Shifa Design System (components)
approved sheet ──▶ component code            approved screen ──▶ screen code
```

- A value changes in `packages/tokens`, is regenerated (drift-checked) and synced. Nothing is edited in the design system.
- A component enters the design system only after it is built and tested in `packages/ui`.
- A drawing is the approved look. Behaviour (RTL keyboard, focus, typeahead, screen reader, digits) is proven by tests only.

### Component cycle (per batch)

1. **Sheet:** every component of the batch in all its states (default, hover, focus, pressed, disabled, invalid, loading), light and dark, RTL and LTR, both densities, with the real tokens and synthetic names.
2. **Approval:** the owner approves the sheet, once per batch; changes are made on the sheet.
3. **Code:** built in `packages/ui` to match the sheet, with the RTL, axe and screenshot tests.
4. **Sync:** `pnpm design-system:build` and the publish in `docs/process/ui-screenshots.md` push the real components; the sheet is marked superseded.

### Screen cycle (Phase A onward)

Amended by [ADR-0042](../adr/0042-screens-drawn-per-ui-batch-with-analysis.md) (owner, 2026-11-23).

1. **Inventory in `/spec`:** the spec lists each screen in words: purpose, sizes, every state and the data and actions it shows. No drawing.
2. **Draw at the UI batch:** after the API is built, the first checkpoint of a UI batch slice draws its screens (one or several) in Arabic RTL, light and dark, at the sizes needed, with synthetic data. The Shifa Design System is installed and used throughout: its real components from the bundle, its tokens for every colour, space, radius, shadow and size, its type styles; no literal colour or own value; the artboards are checked for both before they are shown (OD-80).
   - The batch is a working prototype: artboards marked interactive, fields and buttons work, the flow runs from screen to screen, and every listed state is reachable in Play; the owner tests it there before approving (OD-80).
3. **Analyse:** with the drawings, a written analysis in the slice file: API gaps (fixed in the slice or a small slice before it, never worked around in the client), spec gaps, professional and creative improvements with their cost (the owner accepts or declines each), and missing components.
4. **Approval:** the owner approves the batch's drawings; nothing in it is coded before.
5. **Code:** built to match; the slice compares the browser screenshot (real backend) with the drawing and fixes or explains each difference.
6. **Missing component:** it goes through the component cycle first; no one-off inside a screen. Drawings made before their batch are drafts, reviewed at the batch.

### Limits

- Bundling `packages/ui` for the design system works (slice 0.4-03, Button and Icon). The bundle is one classic script with React 19 inside, because React 19 ships no browser global and a canvas runs React 18. Its components are islands with their own React root, so only text children cross from a canvas. Direction, theme and density come from the page's attributes. The fallback (static previews from Storybook) is not needed. How the system is rebuilt and synced: `docs/process/ui-screenshots.md`.
- Direction variants follow the nearest `dir` (`rtl:`/`ltr:` are `:dir()`), so an LTR region inside an RTL page is LTR. Tailwind's default matched every descendant of an RTL page; the design-system preview found it.
- A screens canvas holds a copy of the tokens taken when the design system was installed; refresh it after a token change.
- Patient app (Flutter): drawings are a visual reference; `shifa_ui` golden tests are the check.
- Standalone Claude Design (claude.ai/design) closes on 2026-12-14; the project uses the artifact types inside Claude.

## Working with Claude Code

- `/spec` lists the screens of a feature in words; the first checkpoint of each UI batch slice draws them with the analysis and gets the owner's approval; `/build-slice` compares the built screen with the approved drawing (ADR-0040, ADR-0042).
- The `/ui-component` skill holds the component checklist (the design sheet and its approval, API conventions, RTL, a11y, stories, tests, the sync to the design system) and points to the best existing component to copy.
- The upstream `ui-sdk` agent skill is not vendored; `/ui-component` (`references/ui-sdk.md`) holds our notes, re-read at every UI SDK upgrade (ADR-0041).

## Effort and risks

- Estimated 4.5–6.5 person-months for the first complete version (vs 1–2 for re-skinning a ready-made kit) [RN-19]; Phase 0.4 delivers the core set, the rest grows with features.
- Risks: behaviour changes between UI SDK betas (pin, upgrade in its own PR, full test run), RTL edge cases (test every component), complex widgets (date/time, tables, charts) taking longer than planned.
