# Design directions (slice 0.4-02)

Four interactive prototypes of Shifa's design language, each on the same three screens, so the owner can compare them and pick one (spec 0.4, criterion 4; OD-57). They are drawn in the Shifa design project, exported as static builds and committed here as the record of the decision. The three not chosen stay.

| Folder | Direction | Brief |
|---|---|---|
| `a/` | Precise (الدقيق) | [briefs/a.md](briefs/a.md) |
| `b/` | Calm (الهادئ) | [briefs/b.md](briefs/b.md) |
| `c/` | Warm (الدافئ) | [briefs/c.md](briefs/c.md) |
| `d/` | Courtyard (أرض الديار) | [briefs/d.md](briefs/d.md) |

Chosen: not yet.

## Opening a build

Open a screen file in a browser; a build needs no server and makes no network request.

- `reception-queue.html`: reception queue, desktop.
- `doctor-visit.html`: doctor visit, desktop and 10-inch tablet.
- `patient-booking.html`: patient booking, phone.

Each screen has switches for theme (`data-theme`: light, dark) and density (`data-density`: comfortable, compact). Every number is in Western digits (OD-20).

## Rules for a build

Shared by the four briefs in [briefs/common.md](briefs/common.md) and checked by `scripts/test/design-directions.test.mjs`:

- Three entry files with the names above, `lang="ar"` and `dir="rtl"`.
- No external URL: fonts, icons and scripts are inside the build.
- People are shown by names made from the lists of `@shifa/testing` only, each in an element with `data-person="<full name>"`.
- The folders `a/` to `d/` are exported files: excluded from Biome and ESLint and marked `linguist-generated`. Do not edit them by hand; change the design and export again.
