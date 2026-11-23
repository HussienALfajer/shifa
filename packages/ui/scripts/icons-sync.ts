// pnpm --filter @shifa/ui icons:sync — rewrites the vendored Solar icons from @iconify-json/solar:
// src/icons/solar/*.svg (web, design system) and shifa_ui's glyphs.g.dart (Flutter). Run it after
// changing src/icons/sources.ts or the package version; test/icons-vendored.test.ts fails until
// the files match. LICENSE.md in src/icons/solar/ is written by hand.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DART_FILE, dartGlyphs, SOLAR_DIR, solarFiles } from './icons.ts';

mkdirSync(SOLAR_DIR, { recursive: true });
const files = solarFiles();
for (const old of readdirSync(SOLAR_DIR)) {
  if (old.endsWith('.svg') && !files.has(old)) rmSync(join(SOLAR_DIR, old));
}
for (const [name, svg] of files) writeFileSync(join(SOLAR_DIR, name), svg);
writeFileSync(DART_FILE, dartGlyphs());
process.stdout.write(`icons: ${String(files.size)} Solar files and glyphs.g.dart written\n`);
