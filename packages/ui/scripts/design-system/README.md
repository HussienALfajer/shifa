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
| Motion | 150 ms hover and press, 200 ms popovers, 240 ms dialogs; ease out, 8 px rise; off under reduced motion. (Motion has no section in tokens.json; the component stylesheet carries the values from code.) | `shifa-motion-*` |
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

- **Solar** by 480 Design (CC BY 4.0), the **Broken** style: outline glyphs whose strokes are deliberately gapped, one round 1.5 px stroke on a 24 grid, no fill and no second tone. 20 px in rows and controls (`shifa-size-icon-sm`), 24 px in navigation and cards (`shifa-size-icon-md`).
- The ink is the text colour (`shifa-color-icon-default`): near-black in light, light in dark. Inside a disabled control the icon greys with the control's text.
- Medical glyphs: stethoscope, syringe, medicines, blood drop and heart from Solar; the tooth from Healthicons (CC0), since Solar has none.
- Credit: "Solar icons by 480 Design, CC BY 4.0" travels with the icons.
- Mirror only directional icons in RTL. The **Icons** group shows the set in the light ink; the `Icon` component draws any of them in code.

## Components

Each component is coded from a sheet the owner approved, tested in Arabic RTL and English LTR, light and dark, both densities, with axe and screenshots, and only then synced here. Use the component; never redraw a look-alike. A screen imports it from the bundle with any of its props (`components/index.d.ts`), whatever this page's card shows; every variant, size and state of each, working in Play, is on the [Shifa Components](https://claude.ai/artifact/Kk3HMckdzqQ4yAyxWpu8kd) canvas, linked at the end of each component's guidelines.

- **Button**: primary (one per view), secondary (the default), ghost, danger (brick, never red); sm, md, lg; an icon on the logical start; loading keeps its label and focus.
- **Icon**: the curated Solar Broken set (and the Healthicons tooth) by name.
- **Tabs**: views of one record; the selected tab green, heavier and underlined.
- **Dialog**: a modal decision or short form; the main action last, the safe one focused first.
- **Popover**: a small panel under a button, at its logical start.
- **Menu**: actions from a button; the danger item last; a submenu opens toward the logical end.
- **Select**: one of a short list; the chosen option has a check; typing finds a name without «د.».
- **Combobox**: search a long list; a word of the name starts with what was typed.
- **NumberInput**: − at the logical start, + at the end; Western digits with comma grouping.
- **DatePicker**: dd/mm/yyyy, Gregorian, the week from Saturday, Levantine month names.
- **IconButton**: a square Button with one icon; its `label` names it; md 44, sm 36.
- **Input**, **Textarea**, **PasswordInput**: the shared field box; an error is a 2 px danger border with an icon and text; `dir: 'auto'` for Latin content; the password toggle sits inside at the logical end.
- **Checkbox**, **RadioGroup**, **Switch**: a 20 px mark or a 44 × 24 track at the logical start, the line a 44 px target; checkbox for a form, switch for a setting that acts at once.
- **OtpInput**: six 48 × 52 slots, left to right in both directions (OD-62); one field for screen readers.
- **TimeInput**: hour and minute (and ص/م on the 12-hour clock, a clinic setting, OD-62), left to right; the value is "HH:mm".
- **Field**: label, required asterisk, hint and error around a control.
- **Form**: a whole form in one state; in code React Hook Form with the server's Zod schema, errors as i18n keys.
- **Tooltip**: a dark ink bubble above its trigger, 240 px at most; keyboard focus opens it at once, hover after 500 ms, touch never; never the only copy of what a person needs.
- **Accordion**: sections of a record in one card; 48 px headers in headings, the caret at the logical end turned over and the text heavier when open; one open at a time unless `multiple`.
- **SegmentedControl**: one choice of two to five that switches a view at once; the chosen segment white, raised and heavier; the arrows choose as they move.
- **AlertDialog**: the Dialog's panel for a question that needs an answer; a danger or info mark before the title, «رجوع» focused first, the action last; no close button and no closing by a press outside.
- **Drawer**: a 400 px panel from the logical end (the left in Arabic), radius 16 on its inner edge; `side="bottom"` on a tablet or phone with a named grabber.
- **Toast**: a small white card at the bottom, at the logical end (the bottom left in Arabic), three at most, the newest at the bottom; status toasts carry their icon; errors stay until closed. In code one `ToastProvider` and `useToast()`.
- **CommandPalette**: one search over patients and actions in a 560 px panel near the top; an Arabic name is found whatever its alef form or diacritics, and the match is marked in gold.
- **Spinner**: the four jasmine petals of the logo lighting in turn, for waits without a known shape; shows after 400 ms, stays at least 400 ms, still under reduced motion; inside a busy Button it is the button's mark.
- **Badge**: a small mark; neutral, brand and outline follow the clinic; status and visit-queue tones are locked and always carry their icon. **CountBadge**: tabular Western digits, «99+» at most, nothing at 0, or a dot.
- **Avatar**: a picture, or the first letters of the first and last names on one of the six avatar hues picked from the name; sizes 24 to 80; a group overlaps toward the logical end and ends with «+3».
- **Skeleton**: blocks, lines and circles on the raised surface for content of a known shape; a soft pulse, still under reduced motion.
- **Card**: a white surface with header, body and footer; a link card opens its record from anywhere on it.
- **EmptyState**: the jasmine or star line drawing (or an icon for search and errors), a title, a description, up to two buttons.
- **Callout**: a message inside the page that stays while its cause holds (a lock, no connection, a session that ended, a suspended clinic); locked status colours with an icon, an optional title, one or two sentences, at most one button at the end of the line, no close button.
- **QrCode**: the authenticator's `otpauth://` link as a code a camera reads, drawn in the page; a white plate with ink modules in both themes, never mirrored; a spinner in its place while it loads; folded on phones behind the app link.
- **CodeList**: the ten recovery codes, shown once: numbered, monospaced, two columns left to right in both directions, «نسخ الكل» and «طباعة» (a light sheet with the person, the clinic and the date).
- **CopyField**: a value shown once to copy or send (a setup link): read-only, left to right in the mono font, «نسخ» inside the box at the logical end, optional «إرسال عبر واتساب» and an expiry line; a refused copy selects the value to copy by hand.
- **Toolbar**: light buttons in a bordered strip with one Tab stop; what does not fit goes into «المزيد».
- **Pagination**: previous at the logical start, numbers with ellipses, the current one green, the page-size select and «عرض 51–75 من 312».
- **DataTable**: a dense grid of 48 px rows (32 compact) with a sticky header, the first column pinned at the logical start, sorting, selection and column visibility, fast with thousands of rows; one Tab stop and arrows in the reading direction.

Tabs, Dialog, Popover, Menu, RadioGroup, Field, Form, Tooltip, Accordion, AlertDialog, Drawer, Toast, CommandPalette, Card, Skeleton, EmptyState, Callout, Toolbar, Pagination and DataTable take their content as data here (`items`, `fields`…); in code they are composed from parts.

## Logo

"Jasmine Cross" (ياسمينة الشفاء): four jasmine petals on the diagonals draw a medical cross in the space between them; the gold dot is the patient. Use the files in **Logos** as they are; never redraw or retype them. Keep clear space of twice the gold dot's diameter on every side. Horizontal lockup is the primary logo; stacked for square spaces; the mark alone where the name is already shown. Reverse on night green or dark surfaces, white on leaf green or photos, mono for one-colour print.

## Not synced yet

- Motion durations and easings, the raw type scale (`shifa-font-*`) and the text tokens (`shifa-text-*`): this format has no section for them, so `components/bundle.css` declares their values from code; a canvas that loads `tokens.css` and `bundle.css` has every token the components read.
- Compact density: shown in each token's note and in the component stylesheet, not as separate token values.
