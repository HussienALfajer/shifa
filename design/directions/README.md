# Design directions (slice 0.4-02)

Four interactive prototypes of Shifa's design language, each on the same three screens, so the owner can compare them and pick one (spec 0.4, criterion 4; OD-57). They were drawn in a design canvas of the owner's account ("Shifa Design Directions"), and are kept here as static builds, as the record of the decision. The three not chosen stay.

| Folder | Direction | Brief |
|---|---|---|
| `a/` | Precise (الدقيق) | [briefs/a.md](briefs/a.md) |
| `b/` | Calm (الهادئ) | [briefs/b.md](briefs/b.md) |
| `c/` | Warm (الدافئ) | [briefs/c.md](briefs/c.md) |
| `d/` | Courtyard (أرض الديار) | [briefs/d.md](briefs/d.md) |

Chosen: **C, Warm (الدافئ)**, by the owner on 2026-11-20. Its values are in `docs/architecture/design-system.md` ("Design language") and in `packages/tokens`.

## Opening a build

Open a screen file in a browser; a build needs no server and makes no network request.

- `reception-queue.html`: reception queue, desktop.
- `doctor-visit.html`: doctor visit, desktop; `doctor-visit-tablet.html`: the same visit on a 10-inch tablet (1280 × 800).
- `patient-booking.html`: patient booking, phone.

The bar at the top of each page links the four screens and switches theme (`data-theme`: light, dark) and density (`data-density`: comfortable, compact). Every number is in Western digits (OD-20).

## How the builds are made

`source/` holds the sixteen artboards as drawn in the design canvas (`*.dc.html`; `Main.dc.html` is direction D's reception queue). `node scripts/design-directions-build.mjs` turns them into the builds: the first state rendered as plain HTML, a small `runtime.js` for the clicks, and the fonts of `packages/tokens/fonts/`. Change a source file and run the script again. The sources name the UI font Shifa Sans Arabic, the renamed subsets of IBM Plex Sans Arabic (OD-59, slice 0.4-10): look at the builds, since a source opened on its own falls back to the system font.

## Rules for a build

Shared by the four briefs in [briefs/common.md](briefs/common.md) and checked by `scripts/test/design-directions.test.mjs`:

- Four entry files with the names above, `lang="ar"` and `dir="rtl"`.
- No external URL: fonts, icons and scripts are inside the build.
- People are shown by names made from the lists of `@shifa/testing` only, each in an element with `data-person="<full name>"`.
- The folders `a/` to `d/` are generated files: excluded from Biome and ESLint and marked `linguist-generated`. Do not edit them by hand; change a file in `source/` and run the build script.
- The density switch changes the desktop screens only; the tablet and phone screens stay comfortable.
