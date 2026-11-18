// Edge case: a provider rejects or rate-limits; the generator retries, then records the failure.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/generate.ts';
import { readManifest } from '../src/manifest.ts';
import { ProviderError, type SynthesisResult, type TtsProvider } from '../src/provider.ts';
import { createFakeProvider } from '../src/providers/fake.ts';
import { withRetry } from '../src/retry.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';

/** The fake provider, except that chosen texts fail with the given errors first. */
function flakyProvider(failures: Map<string, ProviderError[]>): {
  provider: TtsProvider;
  calls: string[];
} {
  const inner = createFakeProvider();
  const calls: string[] = [];
  const provider: TtsProvider = {
    name: 'fake',
    async synthesize(text: string, voice: string): Promise<SynthesisResult> {
      calls.push(text);
      const queue = failures.get(text);
      const next = queue?.shift();
      if (next) throw next;
      return inner.synthesize(text, voice);
    },
  };
  return { provider, calls };
}

const rateLimited = (retryAfterMs: number) =>
  new ProviderError('rate limited', { status: 429, vendorCode: 'TooManyRequests', retryAfterMs });
const unavailable = () =>
  new ProviderError('unavailable', { status: 503, vendorCode: 'UNAVAILABLE' });

describe('withRetry', () => {
  it('honours Retry-After on 429, then succeeds', async () => {
    const { waits, sleep } = fakeSleep();
    let attempt = 0;
    const result = await withRetry(
      () => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(rateLimited(7000));
        return Promise.resolve('ok');
      },
      { sleep, random: () => 0.5 },
    );
    expect(result).toEqual({ ok: true, value: 'ok', attempts: 2 });
    expect(waits).toEqual([7000]);
  });

  it('gives up after five attempts with exponential backoff and does not retry a 400', async () => {
    const { waits, sleep } = fakeSleep();
    const failed = await withRetry(() => Promise.reject(unavailable()), {
      sleep,
      random: () => 0,
    });
    expect(failed.ok).toBe(false);
    expect(failed.attempts).toBe(5);
    expect(waits).toHaveLength(4);
    for (let i = 1; i < waits.length; i += 1) expect(waits[i]).toBeGreaterThan(waits[i - 1] ?? 0);

    const bad = new ProviderError('bad request', { status: 400, vendorCode: 'INVALID_ARGUMENT' });
    const once = await withRetry(() => Promise.reject(bad), { sleep, random: () => 0 });
    expect(once.attempts).toBe(1);
  });
});

describe('generator retries', () => {
  it('records five 503s as failed, exits non-zero, and a re-run regenerates only that clip', async () => {
    const outDir = tempOutDir();
    const target = 'إلى العيادة رقم ثلاثة';
    const failures = new Map([[target, Array.from({ length: 5 }, unavailable)]]);
    const first = flakyProvider(failures);
    const { log } = recordingLog();
    const run1 = await generate({
      provider: first.provider,
      voice: 'fake-1',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log,
      sleep: fakeSleep().sleep,
    });
    expect(run1.exitCode).not.toBe(0);
    const runDir = join(outDir, 'fake', 'fake-1');
    const manifest = readManifest(join(runDir, 'manifest.json'));
    const room3 = manifest.clips.find((c) => c.clipId === 'room-3');
    expect(room3?.status).toBe('failed');
    expect(room3?.error).toEqual({ status: 503, vendorCode: 'UNAVAILABLE' });
    expect(room3?.attempts).toBe(5);
    expect(first.calls.filter((t) => t === target)).toHaveLength(5);

    const second = flakyProvider(new Map());
    const run2 = await generate({
      provider: second.provider,
      voice: 'fake-1',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log,
      sleep: fakeSleep().sleep,
    });
    expect(run2.exitCode).toBe(0);
    expect(second.calls).toEqual([target]);
    const after = readManifest(join(runDir, 'manifest.json'));
    expect(after.clips.every((c) => c.status === 'ok')).toBe(true);
  });

  it('honours a 429 with Retry-After inside a run', async () => {
    const outDir = tempOutDir();
    const target = 'إلى العيادة رقم واحد';
    const { provider } = flakyProvider(new Map([[target, [rateLimited(2000)]]]));
    const { waits, sleep } = fakeSleep();
    const run = await generate({
      provider,
      voice: 'fake-1',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log: recordingLog().log,
      sleep,
    });
    expect(run.exitCode).toBe(0);
    expect(waits).toEqual([2000]);
  });
});
