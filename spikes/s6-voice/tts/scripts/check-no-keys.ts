// Fails when a key pattern appears in the spike folder or the output/log folder (ADR-0026). Prints
// file, line and kind, never the matched value. The spike folder includes .out/. Also looks for
// the owner's real key values from .env.local as literal strings. Runs in the s6-voice workflow,
// before every commit in 0.3-S6b, and (on the output folder) at the generator's exit.
import { relative } from 'node:path';
import { localSecrets } from '../src/env.ts';
import { scanForKeys } from '../src/keys.ts';
import { SPIKE_DIR } from '../src/paths.ts';

export { type KeyFinding, scanForKeys } from '../src/keys.ts';
export { SPIKE_DIR };

if (import.meta.main) {
  const roots = process.argv.slice(2);
  const findings = scanForKeys(roots.length > 0 ? roots : [SPIKE_DIR], localSecrets());
  for (const f of findings) {
    process.stderr.write(`${relative(process.cwd(), f.file)}:${String(f.line)} ${f.kind}\n`);
  }
  process.stdout.write(`key check: ${findings.length === 0 ? 'pass' : 'fail'}\n`);
  process.exit(findings.length === 0 ? 0 : 1);
}
