// Generic drift-check runner (scripts/check-drift.mjs). Each registered check regenerates its
// outputs into a fresh temp directory; the committed files must match byte for byte after LF
// normalisation. Reports paths only, never file contents.
//
// Check shape (scripts/drift.config.mjs):
//   name      — short id, used in reports and log names
//   inputs    — repo-relative paths the generator reads (documentation; listed by --list)
//   outputs   — repo-relative files or directories the check owns
//   generate  — (outDir, { root }) => void | { problems: string[] }; writes outputs at their
//               repo-relative paths under outDir. Returned problems count as drift; a throw is a crash.
//   full      — true: run only in full mode (slow toolchains)
//   fixable   — false: --fix never rewrites these outputs (default true)
//   hint      — one line printed under a drifted check
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Repo-relative POSIX paths of every file at `rel` under `base` (a file, a directory or nothing). */
function listFiles(base, rel) {
  const abs = join(base, rel);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => `${rel}/${join(e.parentPath, e.name).slice(abs.length + 1)}`.replaceAll('\\', '/'))
    .sort();
}

// Compared as latin1 so binary files survive; only CRLF line endings are normalised.
const normalised = (path) => readFileSync(path).toString('latin1').replaceAll('\r\n', '\n');

export function compareOutputs(root, outDir, outputs) {
  const stale = [];
  const missing = [];
  const extra = [];
  for (const rel of outputs) {
    const committed = new Set(listFiles(root, rel));
    const generated = new Set(listFiles(outDir, rel));
    for (const path of generated) {
      if (!committed.has(path)) missing.push(path);
      else if (normalised(join(root, path)) !== normalised(join(outDir, path))) stale.push(path);
    }
    for (const path of committed) if (!generated.has(path)) extra.push(path);
  }
  return { stale, missing, extra };
}

function applyFix(root, outDir, { stale, missing, extra }) {
  for (const path of [...stale, ...missing]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), readFileSync(join(outDir, path)));
  }
  for (const path of extra) rmSync(join(root, path));
}

async function runOne(check, { root, full, fix, logDir }) {
  const base = { name: check.name, stale: [], missing: [], extra: [], problems: [] };
  if (check.full && !full) return { ...base, status: 'skipped' };
  const outDir = mkdtempSync(join(tmpdir(), `drift-${check.name}-`));
  try {
    // Errors while comparing or fixing count as a crash too, so exit 1 always means drift.
    return await generateAndCompare(check, { root, fix, outDir, base });
  } catch (err) {
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, `drift-${check.name}.log`);
    writeFileSync(logPath, `${err?.stack ?? err}\n`);
    return { ...base, status: 'crash', logPath };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

async function generateAndCompare(check, { root, fix, outDir, base }) {
  const returned = await check.generate(outDir, { root });
  const problems = returned?.problems ?? [];
  const diff = problems.length ? base : compareOutputs(root, outDir, check.outputs);
  // The hint explains file drift; returned problems carry their own wording.
  const result = { ...base, ...diff, problems, hint: problems.length ? undefined : check.hint };
  const drifted = problems.length + diff.stale.length + diff.missing.length + diff.extra.length;
  if (!drifted) return { ...result, status: 'clean' };
  if (fix && check.fixable !== false && !problems.length) {
    applyFix(root, outDir, diff);
    return { ...result, status: 'fixed' };
  }
  return { ...result, status: 'drift' };
}

/** Runs the checks in order. Exit code: 0 clean (or fixed), 1 drift, 2 a generator crashed. */
export async function runDrift({ root, checks, full = false, fix = false, logDir }) {
  const results = [];
  for (const check of checks) results.push(await runOne(check, { root, full, fix, logDir }));
  const code = results.some((r) => r.status === 'crash')
    ? 2
    : results.some((r) => r.status === 'drift')
      ? 1
      : 0;
  return { code, results };
}

export function formatReport(results, { fix = false } = {}) {
  const lines = [];
  for (const r of results) {
    lines.push(`  ${r.status.toUpperCase().padEnd(8)} ${r.name}`);
    if (r.status === 'crash') lines.push(`    generator crashed; log: ${r.logPath}`);
    for (const p of r.problems) lines.push(`    problem  ${p}`);
    for (const kind of ['stale', 'missing', 'extra']) {
      for (const path of r[kind]) lines.push(`    ${kind.padEnd(8)} ${path}`);
    }
    if (r.status === 'drift' && r.hint) lines.push(`    ${r.hint}`);
    if (r.status === 'drift' && fix && !r.problems.length) lines.push('    (not fixable)');
  }
  return `${lines.join('\n')}\n`;
}
