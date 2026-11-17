// `pnpm run bench:s4 [--profiles P1,P3] [--studies cbct-300-multi,cbct-1g-multi]
// [--methods chunked,stow,edge] [--no-viewer] [--no-encryption] [--no-variants]`
// Defaults: every profile, the 300 MB and 1 GB studies, every method, the viewer, encryption
// and the chunk (256 KiB, 4 MiB) and bucket (4 MB) variants on P3. P1 × 1 GB alone takes
// hours per method; the CI job picks its matrix through the same flags.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { repoRoot, type StudyName } from '@shifa-spike/s4-generator';
import type { ProfileName } from '@shifa-spike/s4-stack';
import { METHODS, type Method, runBench } from './bench.ts';

const { values } = parseArgs({
  options: {
    profiles: { type: 'string', default: 'P1,P2,P3' },
    studies: { type: 'string', default: 'cbct-300-multi,cbct-300-single,cbct-1g-multi' },
    methods: { type: 'string', default: METHODS.join(',') },
    'no-viewer': { type: 'boolean', default: false },
    'no-encryption': { type: 'boolean', default: false },
    'no-variants': { type: 'boolean', default: false },
    out: { type: 'string', default: join(repoRoot(), '.verify', 's4', 'bench.json') },
  },
});

const list = <T extends string>(value: string, allowed: readonly T[]): T[] => {
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const item of items) {
    if (!allowed.includes(item as T)) throw new Error(`unknown value: ${item}`);
  }
  return items as T[];
};

const variants = !values['no-variants'];
const file = await runBench({
  profiles: list<ProfileName>(values.profiles, ['P1', 'P2', 'P3']),
  studies: list<StudyName>(values.studies, [
    'cbct-20-multi',
    'cbct-20-single',
    'cbct-300-multi',
    'cbct-300-single',
    'cbct-1g-multi',
  ]),
  methods: list<Method>(values.methods, METHODS),
  viewer: !values['no-viewer'],
  encryption: !values['no-encryption'],
  ...(variants ? { chunkSizes: [256 * 1024, 4 * 1024 * 1024], bucketSizesKb: [4096] } : {}),
  out: values.out,
});
process.stdout.write(`bench: ${String(file.rows.length)} rows → ${values.out}\n`);
