#!/usr/bin/env node
// Builds the self-hosted fonts of packages/tokens/fonts (spec 0.4 criterion 5).
//   node scripts/fonts-subset.mjs                 WOFF2 subsets and fonts.json from the TTFs
//   node scripts/fonts-subset.mjs --from <dir>    first import the upstream files from <dir>
//                                                 (<dir>/<family id>/<file>, with OFL.txt)
// Web: one WOFF2 per weight and subset (arabic, latin), chosen by unicode-range. Flutter: the
// static TTFs. A variable upstream font is pinned to one static TTF per weight on import.
// fonts.css: the @font-face rules of the web subsets, under each family's web name.
// OD-59: the OFL of IBM Plex Sans Arabic reserves "Plex" and a subset is a Modified Version, so
// its web subsets are renamed Shifa Sans Arabic (scripts/lib/font-rename.mjs); the static TTFs
// are the unmodified upstream files and keep their name.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import { renameFamily } from './lib/font-rename.mjs';
import { readFontInfo } from './lib/fonts.mjs';

const fontsDir = join(import.meta.dirname, '..', 'packages', 'tokens', 'fonts');

/** Name IDs kept in every subset beyond harfbuzz's default 0–6: the licence and its URL. */
const LICENCE_NAME_IDS = [13, 14];

const FAMILIES = [
  {
    id: 'ibm-plex-sans-arabic',
    family: 'IBM Plex Sans Arabic',
    webFamily: 'Shifa Sans Arabic',
    rename: { 'IBM Plex Sans Arabic': 'Shifa Sans Arabic', IBMPlexSansArabic: 'ShifaSansArabic' },
    role: 'ui',
    source: 'https://github.com/google/fonts/tree/main/ofl/ibmplexsansarabic',
    upstream: {
      400: 'IBMPlexSansArabic-Regular.ttf',
      500: 'IBMPlexSansArabic-Medium.ttf',
      600: 'IBMPlexSansArabic-SemiBold.ttf',
      700: 'IBMPlexSansArabic-Bold.ttf',
    },
  },
  {
    id: 'noto-naskh-arabic',
    family: 'Noto Naskh Arabic',
    webFamily: 'Noto Naskh Arabic',
    role: 'long-text',
    source: 'https://github.com/google/fonts/tree/main/ofl/notonaskharabic',
    variable: 'NotoNaskhArabic-wght.ttf',
    upstream: { 400: null, 700: null },
  },
];

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** What each web subset holds. Shaping forms and ligatures follow through the layout closure. */
const SUBSETS = {
  arabic: {
    unicodeRange:
      'U+060C, U+061B, U+061F, U+0621-063A, U+0640-0655, U+0660-066D, U+0670-0671, U+067E, U+0686, U+0698, U+06A4, U+06A9, U+06AF, U+06BE, U+06C1, U+06CC, U+06D2, U+06D4, U+200C-200F',
    codePoints: [
      0x60c,
      0x61b,
      0x61f,
      ...range(0x621, 0x63a),
      ...range(0x640, 0x655),
      ...range(0x660, 0x66d),
      0x670,
      0x671,
      0x67e,
      0x686,
      0x698,
      0x6a4,
      0x6a9,
      0x6af,
      0x6be,
      0x6c1,
      0x6cc,
      0x6d2,
      0x6d4,
      ...range(0x200c, 0x200f),
    ],
  },
  // Basic Latin, the Latin-1 marks in use, Turkish letters (Azaz surnames) and common punctuation.
  latin: {
    unicodeRange:
      'U+0020-007E, U+00A0, U+00AB, U+00B0, U+00B1, U+00B5, U+00B7, U+00BB, U+00C2, U+00C7, U+00CE, U+00D6-00D7, U+00DB-00DC, U+00E2, U+00E7, U+00EE, U+00F6-00F7, U+00FB-00FC, U+011E-011F, U+0130-0131, U+015E-015F, U+2013-2014, U+2018-2019, U+201C-201D, U+2026',
    codePoints: [
      ...range(0x20, 0x7e),
      0xa0,
      0xab,
      0xb0,
      0xb1,
      0xb5,
      0xb7,
      0xbb,
      0xc2,
      0xc7,
      0xce,
      0xd6,
      0xd7,
      0xdb,
      0xdc,
      0xe2,
      0xe7,
      0xee,
      0xf6,
      0xf7,
      0xfb,
      0xfc,
      0x11e,
      0x11f,
      0x130,
      0x131,
      0x15e,
      0x15f,
      0x2013,
      0x2014,
      0x2018,
      0x2019,
      0x201c,
      0x201d,
      0x2026,
    ],
  },
};

const text = (codePoints) => String.fromCodePoint(...codePoints);
const ttfPath = (family, weight) => join(fontsDir, family.id, 'ttf', `${family.id}-${weight}.ttf`);

const importUpstream = async (from) => {
  for (const family of FAMILIES) {
    mkdirSync(join(fontsDir, family.id, 'ttf'), { recursive: true });
    copyFileSync(join(from, family.id, 'OFL.txt'), join(fontsDir, family.id, 'OFL.txt'));
    for (const [weight, file] of Object.entries(family.upstream)) {
      if (file) {
        copyFileSync(join(from, family.id, file), ttfPath(family, weight));
        continue;
      }
      const source = readFileSync(join(from, family.id, family.variable));
      const all = text([...readFontInfo(join(from, family.id, family.variable)).codePoints]);
      const pinned = await subsetFont(source, all, {
        targetFormat: 'truetype',
        variationAxes: { wght: Number(weight) },
      });
      writeFileSync(ttfPath(family, weight), pinned);
    }
  }
};

const entry = (path, fields) => ({
  path,
  ...fields,
  bytes: statSync(join(fontsDir, path)).size,
  sha256: createHash('sha256')
    .update(readFileSync(join(fontsDir, path)))
    .digest('hex'),
});

/** @font-face rules for the web subsets; URLs are relative to packages/tokens/fonts. */
const fontFaces = (families) =>
  [
    '/* Generated by scripts/fonts-subset.mjs from fonts.json. Do not edit. */',
    ...families.flatMap((family) =>
      family.files
        .filter((file) => file.format === 'woff2')
        .map((file) =>
          [
            '@font-face {',
            `  font-family: '${family.webFamily}';`,
            '  font-style: normal;',
            `  font-weight: ${file.weight};`,
            '  font-display: swap;',
            `  src: url('./${file.path}') format('woff2');`,
            `  unicode-range: ${file.unicodeRange};`,
            '}',
          ].join('\n'),
        ),
    ),
    '',
  ].join('\n');

const build = async () => {
  const families = [];
  for (const family of FAMILIES) {
    mkdirSync(join(fontsDir, family.id, 'web'), { recursive: true });
    const files = [];
    for (const weight of Object.keys(family.upstream).map(Number)) {
      const ttf = ttfPath(family, weight);
      const info = readFontInfo(ttf);
      const source = family.rename
        ? renameFamily(readFileSync(ttf), { replace: family.rename, reserved: /plex/i })
        : readFileSync(ttf);
      for (const [subset, { codePoints, unicodeRange }] of Object.entries(SUBSETS)) {
        const present = codePoints.filter((cp) => info.codePoints.has(cp));
        const woff2 = await subsetFont(source, text(present), {
          targetFormat: 'woff2',
          preserveNameIds: LICENCE_NAME_IDS,
        });
        const path = `${family.id}/web/${family.id}-${weight}-${subset}.woff2`;
        writeFileSync(join(fontsDir, path), woff2);
        files.push(entry(path, { format: 'woff2', weight, subset, unicodeRange }));
      }
      files.push(entry(`${family.id}/ttf/${family.id}-${weight}.ttf`, { format: 'ttf', weight }));
    }
    families.push({
      id: family.id,
      family: family.family,
      webFamily: family.webFamily,
      role: family.role,
      version: readFontInfo(ttfPath(family, 400)).version,
      source: family.source,
      licence: `${family.id}/OFL.txt`,
      files,
    });
  }
  writeFileSync(join(fontsDir, 'fonts.json'), `${JSON.stringify({ families }, null, 2)}\n`);
  writeFileSync(join(fontsDir, 'fonts.css'), fontFaces(families));
  for (const family of families) {
    for (const file of family.files) process.stdout.write(`${file.bytes}\t${file.path}\n`);
  }
};

const args = process.argv.slice(2);
if (args[0] === '--from' && args[1]) await importUpstream(args[1]);
else if (args.length > 0) {
  process.stderr.write('fonts-subset: use --from <dir> or no argument\n');
  process.exit(2);
}
await build();
