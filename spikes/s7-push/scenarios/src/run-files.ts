// Writes a run record as the committed run directory: `meta.json` plus one JSONL file each for
// sends, shown (watcher), probe receipts and inbox records. None of them holds a token: the send
// log and receipts never did, and the device snapshot carries only the token's 12-character hash.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type RunRecord } from './runner.ts';

const jsonl = (rows: unknown[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join('');

export function runDirName(record: RunRecord): string {
  const { meta } = record;
  const date = meta.startedAt.slice(0, 10);
  const api = meta.sdk === null ? meta.serial : `api${String(meta.sdk)}`;
  // A day run not 15 minutes apart is the quick variant (OD-55) and must not share the real one's
  // directory.
  const quick = meta.kind === 'day' && meta.gapS !== 15 * 60 ? ['quick'] : [];
  return [date, meta.state, ...quick, api, ...(meta.app === 'noshow' ? ['noshow'] : [])].join('-');
}

export async function writeRun(root: string, record: RunRecord): Promise<string> {
  const dir = join(root, runDirName(record));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'meta.json'), `${JSON.stringify(record.meta, null, 2)}\n`, 'utf8');
  await writeFile(join(dir, 'sends.jsonl'), jsonl(record.sends), 'utf8');
  await writeFile(join(dir, 'shown.jsonl'), jsonl(record.shown), 'utf8');
  await writeFile(join(dir, 'receipts.jsonl'), jsonl(record.receipts), 'utf8');
  await writeFile(join(dir, 'inbox.jsonl'), jsonl(record.inbox), 'utf8');
  return dir;
}
