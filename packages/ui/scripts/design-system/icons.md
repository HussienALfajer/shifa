# Icons

A representative set of the icons `packages/ui` draws, rendered from the code (`packages/ui/src/icons/`). Each file is drawn in one ink, the icon stroke colour of the light theme, `shifa-color-icon-default` (`#5b6a63`); in a design use the `Icon` component, which takes the colour of its text and mirrors directional icons in RTL.

- **Phosphor** (MIT), duotone: the second tone is 20 % of the stroke. 20 px in rows and controls, 24 px in navigation and cards.
- **Healthicons** (CC0, public domain): `tooth`, `stethoscope`, `syringe`, `medicines`, `blood-drop`, `heart-organ`, copied unchanged except for the ink.
- Directional (mirror in RTL): `arrow-forward`, `arrow-back`, `caret-forward`, `caret-back`, `sign-out`. They are drawn here as in English (left to right).
- The full list of names is `ICON_NAMES` in `packages/ui`; an icon outside it is added there first.
