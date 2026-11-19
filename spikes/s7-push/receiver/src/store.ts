// Append-only JSONL store under the spike's `.out/` directory (git-ignored). `logs/` holds what the
// analysis reads and the key-leak check scans (inbox, receipts, requests, sends); `state/` holds
// the device registry, which needs the full FCM token to send and is never scanned or reported.
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type LogFile = 'inbox' | 'receipts' | 'requests' | 'sends';
export type StateFile = 'devices' | 'dead';

export interface JsonlStore {
  readonly dir: string;
  append: (file: LogFile | StateFile, record: unknown) => Promise<void>;
  readAll: <T>(file: LogFile | StateFile) => Promise<T[]>;
  pathOf: (file: LogFile | StateFile) => string;
}

const STATE_FILES = new Set<string>(['devices', 'dead']);

export function createStore(dir: string): JsonlStore {
  const pathOf = (file: LogFile | StateFile) =>
    join(dir, STATE_FILES.has(file) ? 'state' : 'logs', `${file}.jsonl`);
  // One write chain per store keeps lines whole and in order within this process.
  let chain: Promise<void> = Promise.resolve();
  return {
    dir,
    pathOf,
    append: (file, record) => {
      const path = pathOf(file);
      const line = `${JSON.stringify(record)}\n`;
      chain = chain.then(async () => {
        await mkdir(join(path, '..'), { recursive: true });
        await appendFile(path, line, 'utf8');
      });
      return chain;
    },
    readAll: async <T>(file: LogFile | StateFile) => {
      await chain;
      let text: string;
      try {
        text = await readFile(pathOf(file), 'utf8');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw e;
      }
      return text
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as T);
    },
  };
}
