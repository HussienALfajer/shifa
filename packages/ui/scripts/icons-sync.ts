// pnpm --filter @shifa/ui icons:sync — rewrites the vendored icons from @iconify-json/solar and
// src/icons/health/: the web module src/icons/generated/icons.ts and shifa_ui's glyphs.g.dart.
// Run it after changing src/icons/sources.ts, a Healthicons file or the package version;
// test/icons-vendored.test.ts fails until both match. The licence notes are written by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DART_FILE, dartGlyphs, iconModule, MODULE_FILE } from './icons.ts';

mkdirSync(dirname(MODULE_FILE), { recursive: true });
writeFileSync(MODULE_FILE, iconModule());
writeFileSync(DART_FILE, dartGlyphs());
process.stdout.write('icons: src/icons/generated/icons.ts and glyphs.g.dart written\n');
