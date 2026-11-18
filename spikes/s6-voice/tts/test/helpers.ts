// Shared test helpers: a temporary output folder and a recording log.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect } from 'vitest';

const dirs: string[] = [];
const suiteDirs: string[] = [];

/** A folder removed after the test; made in `beforeAll`, it lives until the file's last test. */
export function tempOutDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 's6-tts-'));
  (expect.getState().currentTestName === undefined ? suiteDirs : dirs).push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

afterAll(() => {
  for (const dir of suiteDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function recordingLog(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = [];
  return { lines, log: (line) => lines.push(line) };
}

/** Never waits: retries in tests use a recorded fake sleep. */
export function fakeSleep(): { waits: number[]; sleep: (ms: number) => Promise<void> } {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

export const FIXED_NOW = () => new Date('2026-11-18T10:00:00Z');
