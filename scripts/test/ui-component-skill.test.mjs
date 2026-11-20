// Spec 0.4 criterion 11 as amended by ADR-0041 (OD-60): the upstream `ui-sdk` skill is not
// vendored; our `/ui-component` skill holds the guidance in our own words, read from a pinned
// upstream commit of the UI SDK version packages/ui uses, so an upgrade forces a re-read.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const skills = join(root, '.claude', 'skills');
const skill = join(skills, 'ui-component');
const notes = readFileSync(join(skill, 'references', 'ui-sdk.md'), 'utf8');
const ui = JSON.parse(readFileSync(join(root, 'packages', 'ui', 'package.json'), 'utf8'));

describe('the ui-component skill (ADR-0041)', () => {
  it('exists with a SKILL.md, and no upstream ui-sdk skill is vendored', () => {
    assert.ok(existsSync(join(skill, 'SKILL.md')));
    assert.deepEqual(
      readdirSync(skills).filter((name) => /^ui-sdk/.test(name)),
      [],
      '.claude/skills holds no copy of the upstream skill',
    );
  });

  it('cites the upstream commit and the UI SDK version packages/ui pins', () => {
    assert.match(notes, /vercel-labs\/ui commit [0-9a-f]{40}/);
    assert.ok(
      notes.includes(`@ui-sdk/core@${ui.dependencies['@ui-sdk/core']}`),
      'references/ui-sdk.md must be re-read and updated for the pinned UI SDK version',
    );
  });

  it('keeps the bridge and outside installs on its "Never" list', () => {
    const never = notes.slice(notes.indexOf('## Never'));
    assert.match(never, /@ui-sdk\/react\/agent/);
    assert.match(never, /npx skills/);
    for (const file of ['SKILL.md', join('references', 'ui-sdk.md')]) {
      const text = readFileSync(join(skill, file), 'utf8');
      assert.doesNotMatch(text, /createAgent\(|registerTools\(/, `${file}: no bridge code`);
    }
  });
});
