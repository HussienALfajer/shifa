// A-01a criterion 16 (review B2 of A-01-02): a client's traceparent decides nothing. The ratio
// sampler decides from the trace id alone, which the client picks, so remote parents get a
// server-side random draw: a crafted id is neither always nor never sampled.
import { ROOT_CONTEXT, SpanKind, TraceFlags, trace } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';
import { traceSampler } from '../../src/telemetry/sdk.ts';

/** The ratio sampler always samples this id (its four 32-bit parts XOR to 0)… */
const ALWAYS = '00000001000000010000000000000000';
/** …and never this one. */
const NEVER = 'ffffffff000000000000000000000000';
const SPAN = '00f067aa0ba902b7';

function sampledShare(traceId: string, flags: TraceFlags, ratio: number, runs = 400): number {
  const sampler = traceSampler(ratio);
  const parent = trace.setSpanContext(ROOT_CONTEXT, {
    traceId,
    spanId: SPAN,
    traceFlags: flags,
    isRemote: true,
  });
  let sampled = 0;
  for (let i = 0; i < runs; i += 1) {
    const { decision } = sampler.shouldSample(parent, traceId, 'GET /x', SpanKind.SERVER, {}, []);
    if (decision === SamplingDecision.RECORD_AND_SAMPLED) sampled += 1;
  }
  return sampled / runs;
}

describe('trace sampler', () => {
  it.each([
    ['a crafted always-sampled id', ALWAYS],
    ['a crafted never-sampled id', NEVER],
  ])('%s with a sampled flag is sampled about at the ratio', (_label, traceId) => {
    const share = sampledShare(traceId, TraceFlags.SAMPLED, 0.5);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it('an unsampled flag cannot hide a request either', () => {
    const share = sampledShare(NEVER, TraceFlags.NONE, 0.5);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it('ratio 0 and 1 hold for remote parents', () => {
    expect(sampledShare(ALWAYS, TraceFlags.SAMPLED, 0, 50)).toBe(0);
    expect(sampledShare(NEVER, TraceFlags.NONE, 1, 50)).toBe(1);
  });
});
