// Checkpoint B: writes the owner's review sheet (every name with tashkeel, every number with its
// words, the room and doctor phrases) to the untracked output folder. Not committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHOSEN_NUMBERS, NAMES } from '../src/data.ts';
import { OUT_DIR } from '../src/paths.ts';
import { buildTestSet } from '../src/testset.ts';

const set = buildTestSet('full');
const lines: string[] = [
  '# S6 review: names and numbers',
  '',
  'Mark a wrong entry and write the correction next to it.',
  '',
  '## Names',
  '',
  '| id | diacritised | plain | origin | hard cases | also plain |',
  '|---|---|---|---|---|---|',
  ...NAMES.map(
    (n) =>
      `| ${n.id} | ${n.diacritised} | ${n.plain} | ${n.origin} | ${n.hard.join(', ')} | ${n.alsoPlain ? 'yes' : ''} |`,
  ),
  '',
  '## Numbers (read after "الرقم")',
  '',
  '| n | words | case |',
  '|---|---|---|',
  ...CHOSEN_NUMBERS.map((e) => `| ${String(e.n)} | ${e.words} | ${e.case} |`),
  '',
  '## Rooms and doctors',
  '',
  ...set.clips
    .filter((c) => c.category === 'room' || c.category === 'doctor')
    .map((c) => `- ${c.id}: ${c.text}`),
  '',
  `Characters in the full set: ${String(set.characters)}`,
  '',
];
const dir = join(OUT_DIR, 'review');
mkdirSync(dir, { recursive: true });
const file = join(dir, 'names-and-numbers.md');
writeFileSync(file, lines.join('\n'));
process.stdout.write(`review sheet: ${file}\n`);
