// Slice 0.4-12 (P-N1, audit 0.4): people's names in code, stories, previews and goldens come from
// the generator in @shifa/testing (.claude/rules/patient-data.md, .claude/rules/ui.md). The four
// names the audit found typed in by hand are refused in every tracked text file of apps, packages,
// scripts, spikes and design. docs/ is left out: it quotes the audit. The names are built from
// their parts here, so this file does not hold them itself.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const SCANNED = ['apps', 'packages', 'scripts', 'spikes', 'design'];
const BINARY =
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|tgz|dcm|nii|bin|jar|keystore|mp4|webm)$/i;
/** Built files: Storybook's static output is rebuilt from the stories. */
const SKIPPED = /(?:^|\/)storybook-static\//;

/** The hand-typed names of the audit (P-N1). */
export const REFUSED = [
  ['أحمد', 'خليل'],
  ['ليلى', 'حداد'],
  ['عمر', 'الخوري'],
  ['Rami', 'Saleh'],
].map((parts) => parts.join(' '));

/** The refused names in `text`. */
export const handTypedNames = (text) => REFUSED.filter((name) => text.includes(name));

const trackedTextFiles = () =>
  execFileSync('git', ['ls-files', '-z', '--', ...SCANNED], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((path) => path && !BINARY.test(path) && !SKIPPED.test(path));

describe('no hand-typed names (0.4-12, P-N1)', () => {
  it('finds each refused name planted in a file', () => {
    for (const name of REFUSED) {
      assert.deepEqual(handTypedNames(`label: '${name}',`), [name], name);
    }
    assert.deepEqual(handTypedNames('label: people(3)[0].name'), []);
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
      for (const name of handTypedNames(text)) found.push(`${path}: ${name}`);
    }
    assert.deepEqual(found, []);
  });
});
