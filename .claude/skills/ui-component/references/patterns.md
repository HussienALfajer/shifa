# Patterns and traps from the RTL gate (slice 0.4-04)

Read with `ui-sdk.md`. Copy the closest component: Select (a field with a list), Popover and Menu (popups), Tabs (no popup), Number Input and Date Picker (digits).

## Code
- Import UI SDK by entry (`@ui-sdk/react/<name>`) and add the entry to `optimizeDeps` in `packages/ui/vitest.config.ts`: found mid-run, Vite reloads and the run fails (duplicate React, missing module).
- `exactOptionalPropertyTypes`: pass optional props as `{...(x === undefined ? {} : { x })}`; wrap UI SDK callbacks so ours receive plain values.
- Fields go through `FieldShell` (`src/field/field-shell.tsx`): label, hint, error with an icon, wired by UI SDK's Field. `FIELD_BOX` styles a box around an input, `FIELD_BOX_SELF` a box that is the control (a trigger button). Use `has-[input:disabled]`, never `has-[:disabled]` (a stepper at its limit is disabled too).
- Triggers that look like a Button use `buttonClasses()`; floating panels use `FLOATING_BOX` (`src/popover/popover.tsx`). Popups render in the top layer, in place; Menu, Select, Combobox and Date Picker content keep the browser's popover box unless styled. Panels fade without a rise, so their geometry is final at once.
- Place a popup against the visible box (`anchor`), and make the element tests measure (the `listbox`) the visible box.
- The design-system bundle has no page reset: give buttons and inputs `border-0`, and inputs their own `font-ui text-body`.
- Digits: show Western (`ar-SY-u-nu-latn`, `en-GB`; OD-20, OD-61); accept Arabic-Indic with `useWesternDigits()` on the input.
- Typeahead text is the item's `label` (and the root `items` label); strip a title such as «د.»; show the full label through a children function (`SelectValue`).
- `initialFocus` and `finalFocus` functions get no arguments: use a ref. Combobox hides non-matching items instead of removing them: render only the matches, filtering by typed text only (`details.reason === 'input-change'`; UI SDK also sets the query to a chosen item's label), and match a query with spaces at a word start (`matchesWordStart`). The calendar is a `<table>`: no flex on its cells.

## Tests
- `describe.each(['rtl', 'ltr'])` with `renderDir`; `expectArrow`, Home and End; `expectPopupSide`; focus in, trapped where it must be, back on the trigger; `expectDigitsAccepted`; `tokenColor`; `expectAxeClean` open and closed, light and dark. A check that does not apply is "n/a" with the reason in the results table.
- Arabic letters: `pressKeys` outside a text field, `typeArabic` inside one (`userEvent.keyboard` sends no key events for them).
- Names from `test/fixtures.ts`. Await every `unmount()`; click an `aria-disabled` element with `{ force: true }`; poll anything that animates.
- Locators from `renderDir` search the whole page, and Tab walks the whole page: unmount the first render before drawing a second one in the same test (slice 0.4-05).
- A segment of Time Input (and Date Input) is an `<input>`: read its `value`, not `textContent`.
- Stories: an open popup is a play story (`parameters.matrix: false`) that waits with `waitFor` (popups fade in). The browser pane draws top-layer popups faded: read computed styles before "fixing" it.

## Slice 0.4-05 traps
- UI SDK owns `data-slot` on its parts: put your own marker (`data-slot="thumb"`, `data-slot="otp-slot"`) on a span inside the part, through its children function.
- Segmented fields (Time Input) take typed text in each segment's own `beforeinput`, ASCII digits only: `useArabicIndicKeys()` on a container re-sends Arabic-Indic digits as Western ones. Size segments with `field-sizing-content` and a 24 px minimum (axe target-size).
- A number laid out left to right inside RTL (OTP slots, a time, a «n / max» counter) gets `dir="ltr"`, and is pushed to the line's start with `justify-end` in Arabic.
- The spacing scale is the token scale only (0–13, 16, 0.5): `py-2.5` or `min-h-20` silently do nothing.
- A label of a disabled group (not a native input) fails axe contrast in the disabled grey: `mutedLabelWhenDisabled` on FieldShell.

## Design system
A public component needs a folder in `scripts/design-system/components/<Name>/` (README and preview) and an entry in `BUNDLE_COMPONENTS` and `bundle-entry.tsx`. A composed component (Tabs, Menu) takes its content as data in `scripts/design-system/compound.tsx`; its parts are listed in `PARTS`.
