# Logo — "Jasmine Cross" (ياسمينة الشفاء)

Status: Approved by owner (2026-11-08) · Last updated: 2026-11-08 · Owner: product owner
Sources: owner conversation 2026-11-08; colours from [design-system](../architecture/design-system.md) ("Platform colour palette")

Purpose: the single reference for Shifa's logo: what it means, which file to use where, and the rules that keep it consistent. The files in [logo/](logo/) are final; use them as they are and never redraw or retype the logo.

## Concept

Four jasmine petals sit on the diagonals. The empty space between them draws a medical "+" without drawing it. A gold dot in the centre is the patient, with care around them. The symbol ties Shifa to Damascus jasmine and to medicine at the same time, and it stays readable at 16 px.

Visual guide: [system](guide/guide-1-system.png) · [colour, versions and misuse](guide/guide-2-colour.png) · [applications](guide/guide-3-applications.png).

## Files

All text is converted to outlines, so no font is needed to use the files.

| File | Use |
|---|---|
| `logo/shifa-logo-horizontal-color.svg` | Primary logo: symbol on the right, name on the left (Arabic reading order) |
| `logo/shifa-logo-stacked-color.svg` | Square spaces: splash screen, posters, profile images |
| `logo/shifa-mark-color.svg` | Symbol alone, where the name is already shown or space is tight |
| `*-reverse.svg` | On night green `#134A3D` or other dark backgrounds |
| `*-mono.svg` | One colour: thermal printers, stamps, fax, engraving |
| `*-white.svg` | White on leaf green or photos with enough contrast |
| `logo/shifa-app-icon.svg`, `logo/png/shifa-app-icon-{1024,512,192}.png` | Store listing and launcher icon |
| `logo/shifa-android-adaptive-foreground.svg`, `…-background.svg` | Android adaptive icon layers (432 px = 108 dp; symbol inside the 66 dp safe zone) |
| `logo/favicon.svg` | Browser tab icon for the web apps and booking pages |

When the apps are built, copy the files into the app packages; this folder stays the source.

## Geometry

Measured in a 100 × 100 box with the centre at (50, 50):

- Each petal is a lens formed by two circles of radius 27.6.
- Each petal is 48 long and starts 10 from the centre. The petals sit at 45°, 135°, 225° and 315°.
- The gold dot has a radius of 6.5 and does not touch the petals, so the one-colour version keeps the dot separate.
- Horizontal lockup: the Arabic name is 0.62 × the symbol height. The gap between symbol and name is 0.20 × the symbol height.
- Wordmark: «شفاء» outlined from El Messiri Bold, "SHIFA" outlined from Outfit SemiBold. Both fonts are under the SIL Open Font License 1.1, so commercial use of the outlines is allowed.

## Colours

| Part | Colour |
|---|---|
| Petals (alternating) | Leaf green `#1F6F5C` and night green `#134A3D` |
| Centre dot | Door gold `#C8A24A` |
| Arabic name | Night green `#134A3D` |
| Latin name | Leaf green `#1F6F5C` |
| Reverse version | Petals `#FBF8F1` and `#E2F0EA`, dot `#C8A24A` |

CMYK values in the visual guide are approximate and must be confirmed with a print proof.

## Rules

- **Clear space:** X is the diameter of the gold dot. Keep at least 2X of empty space around the logo on every side.
- **Minimum size:**

  | Version | Screen | Print |
  |---|---|---|
  | Symbol | 16 px | 5 mm |
  | Horizontal logo | 110 px | 25 mm |

- **Backgrounds:** use the colour version on jasmine `#FBF8F1` or white, and the reverse version on night green. Never place the logo on a low-contrast background, such as the reverse version on mint.
- **Do not** rotate, stretch, recolour the petals (red is reserved for clinical alerts), add shadows or effects, retype the name in another font, or rearrange the parts.
- **Clinic documents:** prescriptions, receipts and reports carry the clinic's own identity. Shifa appears only small in the footer, as "صادرة عبر" plus the horizontal logo.

## Not decided yet

- A dark-mode-specific variant and an animated version (Rive) for the patient app splash and the "you are called" moment are left for Phase 0.4 with the design system.
- The iOS app icon will reuse `shifa-app-icon.svg` when the iOS app is built (Later).
