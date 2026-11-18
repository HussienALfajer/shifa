// Money (OD-50): free tiers only; a run past the free limit is refused before any provider call.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREE_LIMITS, ledgerFile, readLedger, recordUsage } from '../src/budget.ts';
import { generate } from '../src/generate.ts';
import type { ProviderName, SynthesisResult, TtsProvider } from '../src/provider.ts';
import { createFakeProvider } from '../src/providers/fake.ts';
import { buildTestSet } from '../src/testset.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';

function countingProvider(name: ProviderName): { provider: TtsProvider; calls: () => number } {
  const inner = createFakeProvider();
  let calls = 0;
  return {
    provider: {
      name,
      synthesize(text: string, voice: string): Promise<SynthesisResult> {
        calls += 1;
        return inner.synthesize(text, voice);
      },
    },
    calls: () => calls,
  };
}

describe('budget guard', () => {
  it('knows the free limits of Azure F0 and Google Chirp 3 HD', () => {
    expect(FREE_LIMITS.azure).toBe(500_000);
    expect(FREE_LIMITS.google).toBe(1_000_000);
  });

  it('refuses a run that would pass the free limit with this month’s ledger, before any call', async () => {
    const outDir = tempOutDir();
    const set = buildTestSet('full');
    recordUsage(ledgerFile(outDir), {
      provider: 'azure',
      month: '2026-11',
      characters: FREE_LIMITS.azure - set.characters + 1,
    });
    // Last month's usage does not count.
    recordUsage(ledgerFile(outDir), { provider: 'azure', month: '2026-10', characters: 400_000 });
    const { provider, calls } = countingProvider('azure');
    const { lines, log } = recordingLog();
    const run = await generate({
      provider,
      voice: 'ar-SY-LaithNeural',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log,
      sleep: fakeSleep().sleep,
    });
    expect(run.exitCode).not.toBe(0);
    expect(calls()).toBe(0);
    expect(lines.join('\n')).toMatch(/budget/i);
    expect(existsSync(join(outDir, 'azure', 'ar-SY-LaithNeural', 'manifest.json'))).toBe(false);
  });

  it('allows a run that fits and records the billed characters in the ledger', async () => {
    const outDir = tempOutDir();
    const set = buildTestSet('full');
    recordUsage(ledgerFile(outDir), {
      provider: 'google',
      month: '2026-11',
      characters: FREE_LIMITS.google - set.characters,
    });
    const { provider, calls } = countingProvider('google');
    const run = await generate({
      provider,
      voice: 'ar-XA-Chirp3-HD-Charon',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log: recordingLog().log,
      sleep: fakeSleep().sleep,
    });
    expect(run.exitCode).toBe(0);
    expect(calls()).toBe(177);
    const used = readLedger(ledgerFile(outDir))
      .filter((e) => e.provider === 'google' && e.month === '2026-11')
      .reduce((sum, e) => sum + e.characters, 0);
    expect(used).toBe(FREE_LIMITS.google);
  });

  it('--dry-run prints the count and makes no call', async () => {
    const outDir = tempOutDir();
    const { provider, calls } = countingProvider('azure');
    const { lines, log } = recordingLog();
    const run = await generate({
      provider,
      voice: 'ar-SY-AmanyNeural',
      set: 'full',
      outDir,
      dryRun: true,
      now: FIXED_NOW,
      log,
      sleep: fakeSleep().sleep,
    });
    expect(run.exitCode).toBe(0);
    expect(calls()).toBe(0);
    expect(run.plannedCharacters).toBe(buildTestSet('full').characters);
    expect(lines.join('\n')).toContain(String(run.plannedCharacters));
    expect(existsSync(ledgerFile(outDir))).toBe(false);
  });
});
