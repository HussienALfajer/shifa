# Shifa Design System

Shifa (شفاء) is a clinic platform for Syria: the clinic web system, the waiting-room display, public booking pages and a patient app. This system is its one visual language, **Warm (الدافئ)**: a welcoming place, tempered by public-service plainness. Big text, obvious buttons, nothing clever.

**Synced from code, read-only.** Every file here is rebuilt from the repository by `pnpm design-system:build` (`packages/ui/scripts/design-system/`) and synced; nothing is edited on this page. To change anything, change the code and sync again. Token names are the CSS custom properties of the code (`--shifa-color-bg-surface`), so a drawing made with them ports to code as it is.

## Content fundamentals

- **Arabic first, right to left.** Every screen is drawn in Arabic RTL first; English is the second language. Mirror layout and directional icons (arrows, chevrons, "back", sign-out); never mirror numbers, clocks, media controls or the logo.
- **Western digits, tabular.** Times, prices, queue numbers and record numbers use 0–9 (OD-20), in tabular figures so columns line up.
- **Plain words, the clinic's words.** "المريض التالي", not "Next entity". One verb per button: «احجز», «ادفع», «سجّل الوصول». No exclamation marks, no emoji.
- **Synthetic data only.** Names, phone numbers and records in drawings are invented. Never a real patient.
- **Status is never colour alone.** A status is a rounded pill with a filled icon and a word; colour is the third cue.

## Visual foundations

| Item | Rule | Tokens |
|---|---|---|
| Surfaces | White cards on cream, a light border and one small soft shadow. Dropdowns one level higher, dialogs one more; no blur. In dark the border carries the card. | `shifa-color-bg-app`, `shifa-color-bg-surface`, `shifa-color-border-default`, `shifa-shadow-card`, `shifa-shadow-dropdown`, `shifa-shadow-modal` |
| Shape | Rounder: 4 marks, 8 inputs and chips, 12 buttons and cards, 16 dialogs and sheets, full for status pills and number badges. | `shifa-shape-radius-*` |
| Density | Comfortable on touch (44 px controls, 48 px rows); compact on pointer devices only (32 px controls and rows). Notes say "Compact: …" where a value changes; the component stylesheet carries the compact values under `[data-density='compact']`. | `shifa-size-control-*`, `shifa-size-row` |
| Spacing | A 4 px grid; cards pad 24, fields stack 16 apart. | `shifa-space-*`, `shifa-inset-*`, `shifa-gap-*` |
| Focus | A 2 px green outline on every interactive element, with a soft halo outside it; it appears at once, never fades in. | `shifa-color-border-focus`, `shifa-shape-border-focus`, `shifa-shadow-focus` |
| Motion | 150 ms hover and press, 200 ms popovers, 240 ms dialogs; ease out, 8 px rise; off under reduced motion. (Motion has no section here; the values live in code.) | `motion.*` in code |
| Ornament | A small jasmine or eight-point star drawing, in empty states only. | — |

## Colour

The platform palette is **Damascene Jasmine**: leaf green, night green, door gold, cream and ink. Draw with meanings, never palette steps.

- Text: `shifa-color-text-default` on every surface; `shifa-color-text-muted` for hints and metadata; `shifa-color-text-disabled` only inside a disabled control.
- Brand: `shifa-color-brand-primary` for the primary action, links and the selected tab, with `shifa-color-brand-on-primary` on it. Gold (`shifa-color-brand-accent`) is a fill, ring or mark, never body text on a light surface. These brand slots are what a clinic's own palette replaces.
- Selection: `shifa-color-selection-subtle` (hover), `-default` (selected), `-strong` (selected and hovered); text stays `shifa-color-text-default`.
- Overlay: `shifa-color-bg-overlay` behind dialogs and sheets only.
- **Locked colours** (status, sync, clinical alerts, visit queue) mean one thing everywhere and no clinic theme changes them. Each family has `fg`, `bg` and, where it is drawn as a badge, `border`, `solid` and `on-solid`.
  - Status: success green, warning amber, danger brick, info blue, neutral slate.
  - Clinical alerts: info, warning, critical. **Critical is the only red in the product**; danger is brick, not red.
  - Visit queue: booked, confirmed, arrived, waiting, in room, done; exits no-show and cancelled.
- Avatars: six hues (`shifa-color-avatar-*`), picked from the name, never red, with no meaning.
- Components have their own tokens (`shifa-button-*`, `shifa-input-*`, `shifa-card-*`) that point at these meanings; use the component, or its tokens when drawing one by hand.

Every text and icon colour meets WCAG 2.2 on the surfaces its note names, in light and dark (4.5 : 1 text, 3 : 1 icons, borders and focus rings); the code tests it, component pairs included.

## Typography

- **Shifa Sans Arabic** for every screen (400, 500, 600, 700): IBM Plex Sans Arabic, renamed because its licence reserves the name "Plex" for the original (OD-59); copyright and licence kept. **Noto Naskh Arabic** for long reading text such as instructions (400, 700). Both are self-hosted (SIL OFL).
- Ratio 1.25 from 16 px. Use the named styles: Titles (`title-display` 44/700 for queue numbers, `title-lg` 31, `title-md` 25, `title-sm` 20, all 600 at 1.3), Labels (`label-md` 16/500, `label-sm` 14/500), Paragraphs (`paragraph-lg` 18, `paragraph-md` 16, `paragraph-data` 15, `paragraph-caption` 12, `paragraph-reading` 18 Naskh at 1.8).
- Data text never goes below 14 px; 12 px is for captions only.

## Iconography

- **Phosphor** (MIT), duotone: 20 px in rows and controls (`shifa-size-icon-sm`), 24 px in navigation and cards (`shifa-size-icon-md`). The second tone is 20 % of the stroke colour; the mint (`shifa-color-icon-tone-default`) and gold (`shifa-color-icon-tone-current`) tones join with the navigation components.
- **Healthicons** (CC0) for medical glyphs: tooth, stethoscope, syringe, medicines, blood drop, heart.
- Mirror only directional icons in RTL. The **Icons** group shows the set in the stroke colour; the `Icon` component draws any of them in code.

## Components

Each component is coded from a sheet the owner approved, tested in Arabic RTL and English LTR, light and dark, both densities, with axe and screenshots, and only then synced here. Use the component; never redraw a look-alike.

- **Button**: primary (one per view), secondary (the default), ghost, danger (brick, never red); sm, md, lg; an icon on the logical start; loading keeps its label and focus.
- **Icon**: the curated Phosphor and Healthicons set by name.
- **Tabs**: views of one record; the selected tab green, heavier and underlined.
- **Dialog**: a modal decision or short form; the main action last, the safe one focused first.
- **Popover**: a small panel under a button, at its logical start.
- **Menu**: actions from a button; the danger item last; a submenu opens toward the logical end.
- **Select**: one of a short list; the chosen option has a check; typing finds a name without «د.».
- **Combobox**: search a long list; a word of the name starts with what was typed.
- **NumberInput**: − at the logical start, + at the end; Western digits with comma grouping.
- **DatePicker**: dd/mm/yyyy, Gregorian, the week from Saturday, Levantine month names.

Tabs, Dialog, Popover and Menu take their content as data here (`items`, `title`…); in code they are composed from parts.

## Logo

"Jasmine Cross" (ياسمينة الشفاء): four jasmine petals on the diagonals draw a medical cross in the space between them; the gold dot is the patient. Use the files in **Logos** as they are; never redraw or retype them. Keep clear space of twice the gold dot's diameter on every side. Horizontal lockup is the primary logo; stacked for square spaces; the mark alone where the name is already shown. Reverse on night green or dark surfaces, white on leaf green or photos, mono for one-colour print.

## Not synced yet

- The rest of the core set (inputs and forms, more overlays, data display): they arrive batch by batch, after each sheet is approved and the code passes its tests (slices 0.4-05 to 0.4-07).
- Motion durations and easings: this format has no motion section.
- Compact density: shown in each token's note and in the component stylesheet, not as separate token values.
