// Reads run directories, joins each, applies the OD-52 rule and renders `analysis.md` and
// `analysis.json` (criteria 4, 7, 8). Runs are listed by directory name.
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { joinRun } from './join.ts';
import { evaluate, PASS_PCT } from './rule.ts';
import { type Run, type RunMeta, type RunResult, type Verdict } from './types.ts';

async function jsonl<T>(file: string): Promise<T[]> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);
}

export async function readRun(dir: string): Promise<Run> {
  let meta: RunMeta;
  try {
    meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8')) as RunMeta;
  } catch {
    throw new Error(`${dir}: no readable meta.json`);
  }
  return {
    dir: basename(dir),
    meta,
    sends: await jsonl(join(dir, 'sends.jsonl')),
    shown: await jsonl(join(dir, 'shown.jsonl')),
    receipts: await jsonl(join(dir, 'receipts.jsonl')),
    inbox: await jsonl(join(dir, 'inbox.jsonl')),
  };
}

export async function analyse(dirs: string[]): Promise<{ results: RunResult[]; verdict: Verdict }> {
  const runs = await Promise.all(dirs.map(readRun));
  const results = runs.sort((a, b) => a.dir.localeCompare(b.dir)).map(joinRun);
  return { results, verdict: evaluate(results) };
}

const num = (v: number | null) => (v === null ? '–' : String(v));

export function renderMarkdown(results: RunResult[], verdict: Verdict): string {
  const lines = [
    '# Spike 0.3-S7 push: analysis',
    '',
    `Pass mark (OD-52): every graded state and the one-day run ≥ ${String(PASS_PCT)}% shown within 60 s, no message lost, every excluded state detectable.`,
    '',
    `**Verdict: ${verdict.pass ? 'pass' : 'fail'}**`,
    '',
    ...verdict.reasons.map((r) => `- ${r}`),
    ...(verdict.reasons.length > 0 ? [''] : []),
    '| Run | State | API | Graded | n | Expected | Shown | ≤ 60 s | ≤ 60 s % | p50 s | p95 s | max s | Collapsed | Expired | Inbox only | Lost | Detectable | Skew drift |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    lines.push(
      `| ${r.run} | ${r.state}${r.app === 'noshow' ? ' (noshow)' : ''} | ${num(r.sdk)} | ${r.grading} | ${String(r.n)} | ${String(r.expected)} | ${String(r.shown)} | ${String(r.within60)} | ${String(r.within60Pct)} | ${num(r.p50S)} | ${num(r.p95S)} | ${num(r.maxS)} | ${String(r.collapsed)} | ${String(r.expired)} | ${String(r.inboxOnly)} | ${String(r.lost.length)} | ${r.detectability ?? '–'} | ${r.skewFlagged ? 'over 50 ms' : 'ok'} |`,
    );
  }
  const lost = results.flatMap((r) => r.lost.map((id) => `- ${r.run}: ${id}`));
  lines.push('', '## Lost messages', '', ...(lost.length > 0 ? lost : ['None.']), '');
  return lines.join('\n');
}
