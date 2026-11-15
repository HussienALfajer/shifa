// Spec 0.3-S2 criterion 11: the RLS bench report has a strict shape and never carries a
// connection string, a password or a row value (unit test, no Docker).
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type BenchReport,
  benchReportSchema,
  percentile,
  summarize,
  writeBenchReport,
} from '../scripts/bench-report.ts';

const report = (): BenchReport => ({
  date: '2026-11-15T10:00:00.000Z',
  query: 'latest 20 rows of one tenant, ordered by created_at',
  tenants: 50,
  rowsPerTenant: 1000,
  warmup: 200,
  iterations: 2000,
  rls: {
    role: 'shifa_app',
    p50Ms: 0.41,
    p95Ms: 0.62,
    meanMs: 0.44,
    planIndex: 'plan_probe_tenant_created',
  },
  bypass: {
    role: 'shifa_bench_bypass',
    p50Ms: 0.38,
    p95Ms: 0.57,
    meanMs: 0.4,
    planIndex: 'plan_probe_tenant_created',
  },
  overhead: { p50Ratio: 1.08, p95Ratio: 1.09 },
  versions: {
    pgbouncer: 'PgBouncer 1.26.1',
    postgres: '18.6 (Debian 18.6-1.pgdg13+2)',
    drizzle: '1.0.0-rc.5',
    node: 'v24.11.0',
  },
  machine: { cpuModel: 'AMD Ryzen 7 5800H', cores: 16, ramGb: 31.4, platform: 'linux x64' },
});

describe('bench report', () => {
  it('accepts a full report', () => {
    expect(benchReportSchema.safeParse(report()).success).toBe(true);
  });

  it('rejects an extra field', () => {
    expect(benchReportSchema.safeParse({ ...report(), url: 'x' }).success).toBe(false);
  });

  it('rejects a string carrying a connection string or a password', () => {
    for (const value of [
      'postgres://shifa_app:abc@127.0.0.1:6432/shifa_test_9990',
      'password=abc',
      'host 127.0.0.1:6432',
    ]) {
      const leaky = report();
      leaky.query = value;
      expect(benchReportSchema.safeParse(leaky).success, value).toBe(false);
      const leakyVersion = report();
      leakyVersion.versions.pgbouncer = value;
      expect(benchReportSchema.safeParse(leakyVersion).success, value).toBe(false);
    }
  });

  it('writes report.json that holds no URL or password', () => {
    const root = mkdtempSync(join(tmpdir(), 'bench-report-'));
    const dir = writeBenchReport(root, report());
    const text = readFileSync(join(dir, 'report.json'), 'utf8');
    expect(JSON.parse(text)).toEqual(report());
    expect(text).not.toMatch(/postgres(ql)?:\/\/|password/i);
  });

  it('refuses to write an invalid report', () => {
    const root = mkdtempSync(join(tmpdir(), 'bench-report-'));
    expect(() => writeBenchReport(root, { ...report(), iterations: -1 })).toThrow();
  });

  it('computes nearest-rank percentiles and the summary', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(samples, 50)).toBe(50);
    expect(percentile(samples, 95)).toBe(95);
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(() => percentile([], 50)).toThrow();
    expect(summarize([1, 2, 3, 4])).toEqual({ p50Ms: 2, p95Ms: 4, meanMs: 2.5 });
  });
});
