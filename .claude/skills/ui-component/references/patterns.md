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
- `initialFocus` and `finalFocus` functions get no arguments: use a ref. Combobox hides non-matching items instead of removing them: render only the matches. The calendar is a `<table>`: no flex on its cells.

## Tests
- `describe.each(['rtl', 'ltr'])` with `renderDir`; `expectArrow`, Home and End; `expectPopupSide`; focus in, trapped where it must be, back on the trigger; `expectDigitsAccepted`; `tokenColor`; `expectAxeClean` open and closed, light and dark. A check that does not apply is "n/a" with the reason in the results table.
- Arabic letters: `pressKeys` outside a text field, `typeArabic` inside one (`userEvent.keyboard` sends no key events for them).
- Names from `test/fixtures.ts`. Await every `unmount()`; click an `aria-disabled` element with `{ force: true }`; poll anything that animates.
- Stories: an open popup is a play story (`parameters.matrix: false`) that waits with `waitFor` (popups fade in). The browser pane draws top-layer popups faded: read computed styles before "fixing" it.

## Design system
A public component needs a folder in `scripts/design-system/components/<Name>/` (README and preview) and an entry in `BUNDLE_COMPONENTS` and `bundle-entry.tsx`. A composed component (Tabs, Menu) takes its content as data in `scripts/design-system/compound.tsx`; its parts are listed in `PARTS`.
