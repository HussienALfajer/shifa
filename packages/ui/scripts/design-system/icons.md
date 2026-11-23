# Icons

A representative set of the icons `packages/ui` draws, rendered from the code (`packages/ui/src/icons/`). Each file is drawn in one ink, the icon colour of the light theme, `shifa-color-icon-default` (`{{ink}}`, read from the tokens when the system is built); in a design use the `Icon` component, which takes the colour of its text and mirrors directional icons in RTL.

- **Solar** icons by **480 Design**, licensed **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/), the **Broken** style: one round 1.5 px stroke with deliberate gaps, no fill, no second tone; the ink is the text colour (near-black in light, light in dark). 20 px in rows and controls, 24 px in navigation and cards. `sign-out` is Solar's `logout-2` flipped to point to the end of the line.
- Medical glyphs: `stethoscope`, `syringe`, `medicines`, `blood-drop`, `heart-organ` from Solar; `tooth` from **Healthicons** (CC0), since Solar has none.
- Directional (mirror in RTL): `arrow-forward`, `arrow-back`, `caret-forward`, `caret-back`, `sign-out`. They are drawn here as in English (left to right).
- The full list of names is `ICON_NAMES` in `packages/ui`; an icon outside it is added there first.
