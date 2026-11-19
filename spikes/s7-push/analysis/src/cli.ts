// CLI: node src/cli.ts (--run <dir> ... | --runs-root <dir>) [--out <dir>]
// Writes analysis.md and analysis.json (default: next to the runs, `spikes/s7-push/runs/`).
import { readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { analyse, renderMarkdown } from './analyse.ts';

const DEFAULT_ROOT = join(import.meta.dirname, '..', '..', 'runs');

export async function main(argv: string[]): Promise<boolean> {
  const { values } = parseArgs({
    args: argv,
    options: {
      run: { type: 'string', multiple: true },
      'runs-root': { type: 'string' },
      out: { type: 'string' },
    },
  });
  const root = values['runs-root'] ?? (values.run ? undefined : DEFAULT_ROOT);
  const dirs = [
    ...(values.run ?? []),
    ...(root
      ? readdirSync(root)
          .map((d) => join(root, d))
          .filter((d) => statSync(d).isDirectory())
      : []),
  ];
  if (dirs.length === 0)
    throw new Error('usage: --run <dir> ... | --runs-root <dir> [--out <dir>]');
  const { results, verdict } = await analyse(dirs);
  const out = values.out ?? root ?? DEFAULT_ROOT;
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'analysis.md'), renderMarkdown(results, verdict), 'utf8');
  await writeFile(
    join(out, 'analysis.json'),
    `${JSON.stringify({ verdict, results }, null, 2)}\n`,
    'utf8',
  );
  return verdict.pass;
}

if (import.meta.main) {
  main(process.argv.slice(2))
    .then((pass) => {
      process.stdout.write(`verdict: ${pass ? 'pass' : 'fail'}\n`);
    })
    .catch((e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : 'analysis failed'}\n`);
      process.exit(1);
    });
}
