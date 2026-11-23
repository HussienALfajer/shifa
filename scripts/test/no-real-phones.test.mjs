// Slice 0.4-10 F2 (audit 0.4, 2026-11-23): phone numbers in code, stories, previews and
// screenshots come from the generator only (.claude/rules/patient-data.md). Every full Syrian or
// Turkish mobile-shaped number in a tracked text file must carry the generator's marker, which
// `isSyntheticPhone` checks. docs/ is left out: it quotes evidence.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { generatePhone, isSyntheticPhone } from '../../packages/testing/src/synthetic/phones.ts';
import { createRandom } from '../../packages/testing/src/synthetic/random.ts';

const root = join(import.meta.dirname, '..', '..');
const SCANNED = ['apps', 'packages', 'scripts', 'spikes', 'design'];
/**
 * Its rejected cases are real-format numbers on purpose: they prove `isSyntheticPhone`. The
 * common-password list (A-01-02) is a public corpus: one of its entries, the ten-digit keyboard
 * row typed backwards, happens to have a Syrian mobile's shape; it is a password, not a phone.
 */
const EXEMPT = new Set([
  'packages/testing/test/synthetic/phones.test.ts',
  'apps/api/src/modules/identity/common-passwords.json',
]);
const BINARY =
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|tgz|dcm|nii|bin|jar|keystore|mp4|webm)$/i;

// One space or dash may sit between any two digits; no digit or word character on either side.
const SEP = '[ -]?';
const SY = String.raw`(?:\+963|00963|0)${SEP}9(?:${SEP}\d){8}`;
const TR = String.raw`(?:\+90|0)${SEP}5(?:${SEP}\d){9}`;
const MOBILE = new RegExp(String.raw`(?<![\w+])(?:${SY}|${TR})(?!\w)`, 'g');

/** E.164 form of a matched SY or TR mobile number. */
export const toE164 = (match) => {
  const digits = match.replace(/[ -]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00963')) return `+${digits.slice(2)}`;
  // National form: a leading 0, then 9… (Syria, 9 digits) or 5… (Turkey, 10 digits).
  return digits[1] === '9' ? `+963${digits.slice(1)}` : `+90${digits.slice(1)}`;
};

/** Real-format (unmarked) mobile numbers in `text`, as `{ number, e164 }`. */
export const realPhones = (text) =>
  [...text.matchAll(MOBILE)]
    .map(([number]) => ({ number, e164: toE164(number) }))
    .filter(({ e164 }) => !isSyntheticPhone(e164));

const trackedTextFiles = () =>
  execFileSync('git', ['ls-files', '-z', '--', ...SCANNED], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((path) => path && !BINARY.test(path) && !EXEMPT.has(path));

describe('no real-format phone numbers (0.4-10 F2)', () => {
  it('finds a planted real-format number in every written form', () => {
    for (const planted of [
      ['+963', '944', '123', '456'].join(' '),
      ['0944', '123', '456'].join(' '),
      ['00963', '944123456'].join(''),
      ['0999', '000', '111'].join(''),
      ['+90', '532', '123', '45', '67'].join(' '),
      ['0532', '123', '45', '67'].join('-'),
    ]) {
      assert.equal(realPhones(`tel: ${planted}.`).length, 1, planted);
    }
  });

  it('lets a generated number through, in E.164 and in national form', () => {
    const random = createRandom(410);
    for (const country of ['SY', 'TR']) {
      const e164 = generatePhone(random, country);
      const national = `0${e164.slice(country === 'SY' ? 4 : 3)}`;
      assert.deepEqual(realPhones(`${e164} ${national}`), [], e164);
    }
  });

  it('ignores digits inside longer numbers and identifiers', () => {
    assert.deepEqual(realPhones('id_0944123456 1209441234567 a0944123456 x+9639441234567'), []);
  });

  it('finds none in the tracked files of apps, packages, scripts, spikes and design', () => {
    const found = [];
    const files = trackedTextFiles();
    assert.ok(files.length > 100, `only ${String(files.length)} files scanned`);
    for (const path of files) {
      let text;
      try {
        text = readFileSync(join(root, path), 'utf8');
      } catch {
        continue; // listed by git but not on disk (a deletion not yet committed)
      }
      if (text.includes('\0')) continue;
      for (const { number } of realPhones(text)) found.push(`${path}: ${number}`);
    }
    assert.deepEqual(found, []);
  });
});
