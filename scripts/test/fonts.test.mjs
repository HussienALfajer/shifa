// Spec 0.4 criterion 5: the two font families are self-hosted, subsetted and licensed in the
// repository. The manifest (packages/tokens/fonts/fonts.json) is the list; this test checks the
// files against it and holds the size budget.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { readFontInfo } from '../lib/fonts.mjs';

const root = join(import.meta.dirname, '..', '..');
const fontsDir = join(root, 'packages', 'tokens', 'fonts');
const manifestPath = join(fontsDir, 'fonts.json');

/** Bytes; each WOFF2 subset must fit (slice 0.4-02, "Budget"). */
const WOFF2_BUDGET = 60_000;

/** The family name inside the UI web subsets and in the CSS (OD-59). */
const WEB_FAMILY = 'Shifa Sans Arabic';

const FAMILIES = {
  ui: { family: 'IBM Plex Sans Arabic', weights: [400, 500, 600, 700], latin: true },
  'long-text': { family: 'Noto Naskh Arabic', weights: [400, 700], latin: false },
};

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const WESTERN_DIGITS = range(0x30, 0x39);
const ARABIC_INDIC_DIGITS = range(0x660, 0x669);
const ARABIC = [
  ...range(0x621, 0x63a), // letters hamza to ghain
  ...range(0x641, 0x64a), // letters feh to yeh
  ...range(0x64b, 0x652), // tashkeel
  0x60c, // comma
  0x61b, // semicolon
  0x61f, // question mark
  0x640, // tatweel
];
const LATIN = [...range(0x41, 0x5a), ...range(0x61, 0x7a)];
const PUNCTUATION = [0x20, 0x21, 0x25, 0x28, 0x29, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x3a];

const manifest = () => JSON.parse(readFileSync(manifestPath, 'utf8'));
const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );

describe('font manifest', () => {
  it('names exactly the two families of the spec, one per role', () => {
    const families = manifest().families;
    assert.deepEqual(families.map((f) => f.role).sort(), Object.keys(FAMILIES).sort());
    for (const family of families) {
      assert.equal(family.family, FAMILIES[family.role].family);
      assert.match(family.version, /\d/, `${family.family}: version`);
      assert.match(family.source, /^https:\/\//, `${family.family}: source URL`);
    }
  });

  it('lists every font file with its SHA-256, and no font file is outside the list', () => {
    const listed = new Set();
    for (const family of manifest().families) {
      for (const file of family.files) {
        const path = join(fontsDir, file.path);
        assert.ok(existsSync(path), `missing ${file.path}`);
        const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
        assert.equal(sha, file.sha256, `SHA-256 of ${file.path}`);
        listed.add(file.path);
      }
    }
    const onDisk = listFiles(fontsDir)
      .filter((p) => /\.(woff2|ttf|otf|woff)$/.test(p))
      .map((p) => relative(fontsDir, p).replaceAll('\\', '/'));
    assert.deepEqual(
      onDisk.filter((p) => !listed.has(p)),
      [],
      'font files not in fonts.json',
    );
    assert.deepEqual(
      onDisk.filter((p) => /\.(otf|woff)$/.test(p)),
      [],
      'only WOFF2 and TTF',
    );
  });

  it('has an OFL licence file per family', () => {
    for (const family of manifest().families) {
      const text = readFileSync(join(fontsDir, family.licence), 'utf8');
      assert.match(text, /SIL OPEN FONT LICENSE/i, family.licence);
    }
  });

  it('has a WOFF2 and a TTF for every required weight', () => {
    for (const family of manifest().families) {
      for (const format of ['woff2', 'ttf']) {
        const weights = new Set(
          family.files.filter((f) => f.format === format).map((f) => f.weight),
        );
        for (const weight of FAMILIES[family.role].weights) {
          assert.ok(weights.has(weight), `${family.family}: no ${format} at weight ${weight}`);
        }
      }
    }
  });
});

describe('font files', () => {
  it('keeps every WOFF2 subset within the budget', () => {
    for (const family of manifest().families) {
      for (const file of family.files.filter((f) => f.format === 'woff2')) {
        const { size } = statSync(join(fontsDir, file.path));
        assert.ok(size <= WOFF2_BUDGET, `${file.path} is ${size} bytes (budget ${WOFF2_BUDGET})`);
      }
    }
  });

  it('covers Arabic, both digit sets and punctuation at every weight, in WOFF2 and in TTF', () => {
    for (const family of manifest().families) {
      const needed = [
        ...ARABIC,
        ...WESTERN_DIGITS,
        ...ARABIC_INDIC_DIGITS,
        ...PUNCTUATION,
        ...(FAMILIES[family.role].latin ? LATIN : []),
      ];
      for (const format of ['woff2', 'ttf']) {
        for (const weight of FAMILIES[family.role].weights) {
          const covered = new Set();
          for (const file of family.files) {
            if (file.format !== format || file.weight !== weight) continue;
            for (const cp of readFontInfo(join(fontsDir, file.path)).codePoints) covered.add(cp);
          }
          const missing = needed.filter((cp) => !covered.has(cp)).map(hex);
          assert.deepEqual(missing, [], `${family.family} ${format} ${weight}`);
        }
      }
    }
  });

  // OD-59 (owner, 2026-11-20): the OFL of IBM Plex Sans Arabic reserves the name "Plex", and a
  // subset is a Modified Version, so the web subsets carry another family name. The static TTFs
  // are the unmodified upstream files and keep theirs.
  it('names the UI web subsets Shifa Sans Arabic, with no "Plex", and keeps the copyright', () => {
    const ui = manifest().families.find((f) => f.role === 'ui');
    assert.equal(ui.webFamily, WEB_FAMILY);
    const upstream = readFontInfo(join(fontsDir, ui.files.find((f) => f.format === 'ttf').path));
    assert.match(upstream.names.copyright, /IBM Corp/);
    const subsets = ui.files.filter((f) => f.format === 'woff2');
    assert.equal(subsets.length, FAMILIES.ui.weights.length * 2);
    for (const file of subsets) {
      const { names } = readFontInfo(join(fontsDir, file.path));
      const plex = Object.entries(names).filter(([, value]) => /plex/i.test(value));
      assert.deepEqual(plex, [], `${file.path}: name records with "Plex"`);
      assert.equal(names.fontFamily, WEB_FAMILY, `${file.path}: family name`);
      assert.match(names.postscriptName, /^ShifaSansArabic-/, `${file.path}: PostScript name`);
      assert.equal(names.copyright, upstream.names.copyright, `${file.path}: copyright notice`);
      assert.match(names.license ?? '', /Open Font License/, `${file.path}: licence notice`);
    }
    const licence = readFileSync(join(fontsDir, ui.licence), 'utf8');
    assert.match(licence, /Reserved Font Name "Plex"/, 'the upstream OFL is kept unchanged');
  });

  it('keeps the upstream name in the long-text family, which reserves none', () => {
    const naskh = manifest().families.find((f) => f.role === 'long-text');
    assert.equal(naskh.webFamily, naskh.family);
  });

  // Western digits only: the product shows no Arabic-Indic digits (OD-20, closed 2026-11-20),
  // and IBM Plex Sans Arabic sets those proportionally.
  it('gives the Western digits one width in the UI family, so numbers line up in tables', () => {
    const ui = manifest().families.find((f) => f.role === 'ui');
    const checked = new Set();
    for (const file of ui.files) {
      const info = readFontInfo(join(fontsDir, file.path));
      if (!WESTERN_DIGITS.every((cp) => info.codePoints.has(cp))) continue;
      const widths = new Set(info.tabularWidths(WESTERN_DIGITS));
      assert.equal(widths.size, 1, `${file.path}: digits have ${widths.size} widths`);
      checked.add(`${file.format} ${file.weight}`);
    }
    for (const format of ['woff2', 'ttf']) {
      for (const weight of FAMILIES.ui.weights) {
        assert.ok(checked.has(`${format} ${weight}`), `no ${format} with digits at ${weight}`);
      }
    }
  });
});
