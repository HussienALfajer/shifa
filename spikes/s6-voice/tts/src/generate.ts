// One command per provider (criterion 1): generates the test set into `.out/<provider>/<voice>/`
// with a manifest. Budget guard first (OD-50), retries per clip, failures recorded (never a silent
// skip), a re-run regenerates only missing or failed clips, and a key scan at exit (ADR-0026).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBudget, ledgerFile, monthKey, recordUsage } from './budget.ts';
import { makeChime } from './chime.ts';
import { scanForKeys } from './keys.ts';
import {
  MANIFEST_SCHEMA_VERSION,
  type Manifest,
  type ManifestClip,
  readManifest,
  sha256Hex,
  writeManifest,
} from './manifest.ts';
import {
  billedCharacters,
  ProviderError,
  type ProviderName,
  type TtsProvider,
} from './provider.ts';
import { realSleep, withRetry } from './retry.ts';
import { buildTestSet, type Clip, type SetKind } from './testset.ts';
import { parseWav } from './wav.ts';

export const TOOL_VERSION = '0.3-S6a';

const API_VERSIONS: Record<ProviderName, string> = {
  azure: 'Azure AI Speech REST cognitiveservices/v1',
  google: 'Google Cloud Text-to-Speech v1 text:synthesize',
  silma: 'SILMA TTS v1 wrapper (spikes/s6-voice/silma)',
  fake: 'fake',
};

export interface GenerateOptions {
  provider: TtsProvider;
  voice: string;
  set: SetKind;
  outDir: string;
  dryRun?: boolean;
  now?: () => Date;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface GenerateResult {
  /** 0 ok; 1 a clip failed; 2 refused by the budget guard; 3 a key pattern was found. */
  exitCode: number;
  plannedCharacters: number;
  calls: number;
}

/** Clips of an earlier run that are still good: status ok, same text, file present and intact. */
function reusableClips(runDir: string, set: SetKind): Map<string, ManifestClip> {
  const file = join(runDir, 'manifest.json');
  const keep = new Map<string, ManifestClip>();
  if (!existsSync(file)) return keep;
  const previous = readManifest(file);
  if (previous.header.set !== set) return keep;
  for (const clip of previous.clips) {
    const audio = join(runDir, clip.file);
    if (clip.status !== 'ok' || !existsSync(audio)) continue;
    if (sha256Hex(readFileSync(audio)) === clip.sha256) keep.set(clip.clipId, clip);
  }
  return keep;
}

function failure(error: unknown): NonNullable<ManifestClip['error']> {
  if (error instanceof ProviderError) {
    return error.vendorCode === undefined
      ? { status: error.status }
      : { status: error.status, vendorCode: error.vendorCode };
  }
  return { status: -1 };
}

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { provider, voice, outDir } = opts;
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? realSleep;
  const runDir = join(outDir, provider.name, voice);
  const logFile = join(runDir, 'generate.log');
  const log = (line: string) => {
    opts.log?.(line);
    if (existsSync(runDir)) appendFileSync(logFile, `${now().toISOString()} ${line}\n`);
  };

  const testSet = buildTestSet(opts.set);
  const keep = reusableClips(runDir, opts.set);
  const isTodo = (c: Clip) => keep.get(c.id)?.text !== c.text;
  const todo = testSet.clips.filter(isTodo);
  const plannedCharacters = todo.reduce((sum, c) => sum + billedCharacters(c.text), 0);
  const label = `${provider.name}/${voice} set=${opts.set}`;
  log(
    `${label}: ${String(todo.length)} clips to generate, ${String(plannedCharacters)} characters planned`,
  );
  if (opts.dryRun) return { exitCode: 0, plannedCharacters, calls: 0 };

  const ledger = ledgerFile(outDir);
  const month = monthKey(now());
  const budget = checkBudget(ledger, provider.name, month, plannedCharacters);
  if (!budget.allowed) {
    log(
      `${label}: refused by the budget guard: ${String(budget.used)} used in ${month} + ${String(plannedCharacters)} planned > ${String(budget.limit)} free`,
    );
    return { exitCode: 2, plannedCharacters, calls: 0 };
  }

  mkdirSync(runDir, { recursive: true });
  const clips: ManifestClip[] = [];
  let calls = 0;
  for (const clip of testSet.clips) {
    const kept = keep.get(clip.id);
    if (kept && !isTodo(clip)) {
      clips.push(kept);
      continue;
    }
    const base = { clipId: clip.id, category: clip.category, text: clip.text };
    const entry = { ...base, provider: provider.name, voice, file: `${clip.id}.wav` };
    if (clip.category === 'chime') {
      const audio = makeChime();
      writeFileSync(join(runDir, entry.file), audio);
      clips.push({
        ...entry,
        sha256: sha256Hex(audio),
        durationMs: parseWav(audio).durationMs,
        charactersBilled: 0,
        elapsedMs: 0,
        attempts: 0,
        status: 'ok',
      });
      continue;
    }
    const result = await withRetry(
      () => {
        calls += 1;
        return provider.synthesize(clip.text, voice);
      },
      { sleep },
    );
    if (result.ok) {
      const { audio, charactersBilled, elapsedMs } = result.value;
      writeFileSync(join(runDir, entry.file), audio);
      recordUsage(ledger, { provider: provider.name, month, characters: charactersBilled });
      clips.push({
        ...entry,
        sha256: sha256Hex(audio),
        durationMs: parseWav(audio).durationMs,
        charactersBilled,
        elapsedMs: Math.round(elapsedMs),
        attempts: result.attempts,
        status: 'ok',
      });
    } else {
      const error = failure(result.error);
      log(
        `${clip.id}: failed after ${String(result.attempts)} attempts: HTTP ${String(error.status)}${error.vendorCode ? ` ${error.vendorCode}` : ''}`,
      );
      clips.push({
        ...entry,
        sha256: null,
        durationMs: 0,
        charactersBilled: 0,
        elapsedMs: 0,
        attempts: result.attempts,
        status: 'failed',
        error,
      });
    }
  }

  const manifest: Manifest = {
    header: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      provider: provider.name,
      voice,
      set: opts.set,
      generatedAt: now().toISOString(),
      apiVersion: API_VERSIONS[provider.name],
      toolVersion: TOOL_VERSION,
      node: process.version,
    },
    clips,
    announcements: testSet.announcements,
  };
  writeManifest(join(runDir, 'manifest.json'), manifest);
  const failed = clips.filter((c) => c.status === 'failed').length;
  log(
    `${label}: ${String(clips.length - failed)} ok, ${String(failed)} failed, ${String(calls)} calls`,
  );

  const leaks = scanForKeys([outDir]);
  if (leaks.length > 0) {
    log(
      `key check failed: ${leaks.map((f) => `${f.file}:${String(f.line)} ${f.kind}`).join(', ')}`,
    );
    return { exitCode: 3, plannedCharacters, calls };
  }
  return { exitCode: failed === 0 ? 0 : 1, plannedCharacters, calls };
}
