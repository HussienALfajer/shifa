# Solar icons

The SVG files in this folder, and the Flutter painters in
`packages/shifa_ui/lib/src/generated/glyphs.g.dart`, are drawn from the **Solar** icon set by
**480 Design** (https://www.figma.com/community/file/1166831539721848736), "Broken" style. They are
licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**,
https://creativecommons.org/licenses/by/4.0/.

Source: the npm package `@iconify-json/solar` (Iconify's copy of Solar, exact version in
`packages/ui/package.json`). The files are written by `pnpm --filter @shifa/ui icons:sync`
(`packages/ui/scripts/icons.ts`) from the map in `src/icons/sources.ts`, which pairs our icon
names with Solar's (each file starts with a comment naming its Solar icon).

Changes made to the originals (CC BY 4.0, section 3(a)(1)(B)):
- each icon is wrapped as a stand-alone 24 × 24 SVG file;
- `sign-out.svg` (Solar `logout-2`) is flipped horizontally, so it points to the end of the line
  like our other directional icons;
- the Flutter painters re-express the same paths as Dart drawing calls.

Attribution must travel with the icons: the Shifa Design System's Icons note credits Solar, and
the patient app and the clinic web system must credit "Solar icons by 480 Design, CC BY 4.0" on
their About or licences screen (backlog).
