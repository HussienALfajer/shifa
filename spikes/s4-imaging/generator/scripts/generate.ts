// Generates synthetic studies into .cache/s4/studies/ (never committed), e.g.
//   pnpm run generate cbct-300-multi cbct-300-single
// Prints each study's folder, file count and size; no tag values.
import { ensureStudy, STUDIES, type StudyName } from '../src/index.ts';

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in STUDIES));
if (names.length === 0 || unknown.length > 0) {
  process.stderr.write(`usage: generate <study...>; studies: ${Object.keys(STUDIES).join(', ')}\n`);
  process.exit(2);
}
for (const name of names as StudyName[]) {
  const start = performance.now();
  const { dir, manifest } = await ensureStudy(name);
  const bytes = manifest.files.reduce((sum, f) => sum + f.bytes, 0);
  const seconds = ((performance.now() - start) / 1000).toFixed(1);
  process.stdout.write(
    `${name}: ${String(manifest.files.length)} files, ${String(bytes)} bytes, ${seconds} s → ${dir}\n`,
  );
}
