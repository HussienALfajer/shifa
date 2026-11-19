// Builds the owner's blind listening set (criterion 5) or the pre-round set (criterion 2) from
// generation manifests. Served files go to <out>/served/ (read by the listening page); the key goes
// to <out>/, outside the served folder, and is committed only after the analysis.
// CLI: node scripts/build-listening-set.ts --seed <n> [--pre-round] [--out <dir>] <manifest.json>…
import { randomInt } from 'node:crypto';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildListeningSet, writeListeningSet } from '../src/listening-set.ts';
import { readManifest } from '../src/manifest.ts';
import { OUT_DIR } from '../src/paths.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    manifests: { type: 'string', multiple: true, default: [] },
    seed: { type: 'string' },
    'pre-round': { type: 'boolean', default: false },
    out: { type: 'string', default: join(OUT_DIR, 'listening') },
  },
});
const files = [...values.manifests, ...positionals];
// One manifest is a rating-only run (OD-51); the pre-round needs at least two voices.
if (files.length < (values['pre-round'] ? 2 : 1)) {
  throw new Error('usage: build-listening-set [--seed <n>] [--pre-round] <manifest.json>…');
}
// Record the seed in the slice file: it fixes the order and the pairs.
const seed = values.seed === undefined ? randomInt(1, 2 ** 31) : Number(values.seed);
if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
const built = buildListeningSet({
  inputs: files.map((file) => ({ manifest: readManifest(file), dir: dirname(file) })),
  seed,
  mode: values['pre-round'] ? 'pre-round' : 'full',
});
const { servedDir, keyFile } = writeListeningSet(built, values.out);
const count =
  built.set.kind === 'full'
    ? `${String(built.set.items.length)} clips, ${String(built.set.pairs.length)} pairs`
    : `${String(built.set.voices.length)} voices`;
process.stdout.write(
  `set ${built.set.setHash} (seed ${String(seed)}): ${count}\nserved: ${servedDir}\nkey (do not open before the analysis): ${keyFile}\n`,
);
