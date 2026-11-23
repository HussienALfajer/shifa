# Icons

A representative set of the icons `packages/ui` draws, rendered from the code (`packages/ui/src/icons/`). Each file is drawn in one ink, the icon colour of the light theme, `shifa-color-icon-default` (`{{ink}}`, read from the tokens when the system is built); in a design use the `Icon` component, which takes the colour of its text and mirrors directional icons in RTL.

- **Tabler Icons** (MIT), outline: one round stroke, no fill, no second tone; the ink is the text colour (near-black in light, light in dark). 20 px in rows and controls, 24 px in navigation and cards.
- Medical glyphs are Tabler's too: `tooth`, `stethoscope`, `syringe`, `medicines`, `blood-drop`, `heart-organ`.
- Directional (mirror in RTL): `arrow-forward`, `arrow-back`, `caret-forward`, `caret-back`, `sign-out`. They are drawn here as in English (left to right).
- The full list of names is `ICON_NAMES` in `packages/ui`; an icon outside it is added there first.
