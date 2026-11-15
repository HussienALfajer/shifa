// The RLS bench report (spec 0.3-S2 criterion 11): `.verify/s2-bench/report.json`. Latencies,
// versions and machine details only: no connection string, password, userlist or row value. The
// schema is strict, so an extra field fails, and every string is checked for a URL or secret.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// URLs, host:port pairs (names, IPv4, bracketed IPv6), credential words and harness-style hex
// passwords (32 hex digits).
const FORBIDDEN =
  /postgres(ql)?:\/\/|password|secret|[\w.-]+:\d{2,5}\b|\[[\da-f:]+\]:\d+|\b[\da-f]{32}\b/i;

/** Throws when the serialised report contains any of `secrets` (the run's own passwords). */
export function assertNoSecrets(report: BenchReport, secrets: readonly string[]): void {
  const text = JSON.stringify(report);
  if (secrets.some((secret) => secret !== '' && text.includes(secret))) {
    throw new Error('the bench report contains a credential of this run; not written');
  }
}

const safe = (max = 200) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !FORBIDDEN.test(value), 'looks like a connection string or secret');

const millis = z.number().nonnegative();

const runSchema = z.strictObject({
  role: z.enum(['shifa_app', 'shifa_bench_bypass']),
  p50Ms: millis,
  p95Ms: millis,
  meanMs: millis,
  /** The index the measured query's plan used (from EXPLAIN), or `none`. */
  planIndex: safe(),
});

export const benchReportSchema = z.strictObject({
  date: z.iso.datetime(),
  query: safe(),
  tenants: z.int().positive(),
  rowsPerTenant: z.int().positive(),
  warmup: z.int().nonnegative(),
  iterations: z.int().positive(),
  rls: runSchema,
  bypass: runSchema,
  overhead: z.strictObject({ p50Ratio: z.number().positive(), p95Ratio: z.number().positive() }),
  versions: z.strictObject({
    pgbouncer: safe(),
    postgres: safe(),
    drizzle: safe(),
    node: safe(),
  }),
  machine: z.strictObject({
    cpuModel: safe(),
    cores: z.int().positive(),
    ramGb: z.number().positive(),
    platform: safe(),
  }),
});

export type BenchReport = z.infer<typeof benchReportSchema>;

/** Nearest-rank percentile of `samples` (any order). */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) throw new Error('no samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1] ?? Number.NaN;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** p50, p95 and mean in milliseconds, three decimals. */
export function summarize(samples: readonly number[]): {
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
} {
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    p50Ms: round3(percentile(samples, 50)),
    p95Ms: round3(percentile(samples, 95)),
    meanMs: round3(mean),
  };
}

/** Validates, then writes `<root>/.verify/s2-bench/report.json`; returns the directory. */
export function writeBenchReport(root: string, report: BenchReport): string {
  const parsed = benchReportSchema.parse(report);
  const dir = join(root, '.verify', 's2-bench');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), `${JSON.stringify(parsed, null, 2)}\n`);
  return dir;
}
