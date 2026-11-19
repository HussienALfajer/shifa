// 0.3-S5c security review (B1): group message ids carry the sender after the key
// (`false_<group>@g.us_<KEY>_<participant>@lid`); the scrubber must map the key and the
// participant, and the fixture check must refuse any message key that is not a placeholder.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkFixtures, scrubCaptures } from '../src/scrub.ts';

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 's5-group-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('group message ids', () => {
  it('scrubs the key and the participant of a group message id', () => {
    const rawDir = tempDir();
    const outDir = tempDir();
    // Synthetic: a key shape with a digit run inside, as group keys can have.
    const key = 'AC11112222963912345678AAAA0000BBBB';
    const id = `false_120363012345678901@g.us_${key}_204011500700777@lid`;
    const body = JSON.stringify({
      event: 'message.reaction',
      payload: { id, reaction: { text: 'x', messageId: id } },
    });
    writeFileSync(
      join(rawDir, '1-1-000001.json'),
      JSON.stringify({ container: 'clinics', receivedAt: '', headers: {}, body }),
    );
    scrubCaptures({ rawDir, outDir, hmacKeys: {} });
    expect(checkFixtures(outDir)).toEqual([]);
    const text = readFileSync(join(outDir, readdirSync(outDir)[0] ?? ''), 'utf8');
    for (const secret of [key, '120363012345678901', '204011500700777']) {
      expect(text.includes(secret), secret).toBe(false);
    }
    expect(text).toMatch(/false_96393007\d{4}@g\.us_ABCDEF[A-F0-9]+_96393008\d{4}@lid/);
  });

  it('the fixture check refuses a real message key, even one without a long digit run', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'a.json'),
      JSON.stringify({ id: 'false_963930070002@g.us_AC0123456789ABCDEF0123_963930080014@lid' }),
    );
    writeFileSync(
      join(dir, 'b.json'),
      JSON.stringify({ id: 'true_963930080002@lid_ABCDEFABCD0042' }),
    );
    expect(checkFixtures(dir).map((p) => p.split(' ')[0])).toEqual(['a.json']);
  });
});
