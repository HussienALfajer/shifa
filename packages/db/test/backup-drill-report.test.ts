// Spec 0.2-09c criteria 7 and 8: the drill report's schema accepts a full report, rejects a
// missing check or an extra field, the Markdown lists every check, and a value or connection
// string planted in a reason fails the guard.
import { describe, expect, it } from 'vitest';
import {
  DRILL_CHECKS,
  type DrillReport,
  drillReportSchema,
  failedRestoreReport,
  reportMarkdown,
  restoreRate,
} from '../scripts/backup-drill-report.ts';

const report = (): DrillReport => ({
  date: '2026-11-11T14:27:22.623Z',
  postgresVersion: '18.6 (Debian 18.6-1.pgdg13+2)',
  pgbackrestVersion: '2.60.0',
  backupLabel: '20261111-142700F',
  targetTime: '2026-11-11T14:27:05.389697Z',
  restoreSeconds: 15,
  restoredMegabytes: 30.2,
  rateMegabytesPerMinute: 120.8,
  maxRestoreMinutes: 15,
  passed: true,
  checks: DRILL_CHECKS.map((name) => ({ name, passed: true, reason: '700 rows, checksums equal' })),
});

describe('drill report', () => {
  it('accepts a full report', () => {
    expect(drillReportSchema.safeParse(report()).success).toBe(true);
  });

  it('rejects a missing check', () => {
    const r = report();
    r.checks = r.checks.filter((c) => c.name !== 'rls.presence');
    expect(drillReportSchema.safeParse(r).success).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(drillReportSchema.safeParse({ ...report(), connectionString: 'x' }).success).toBe(false);
  });

  it('rejects passed=true with a failed check', () => {
    const r = report();
    r.checks[0] = { name: 'rows.baseline_and_a', passed: false, reason: '1 row missing' };
    expect(drillReportSchema.safeParse(r).success).toBe(false);
  });

  it('rejects a reason carrying a connection string or a row value', () => {
    for (const reason of [
      'postgres://postgres:pw@127.0.0.1:55432/shifa',
      'row {"name": "x"} differs',
      'password mismatch',
    ]) {
      const r = report();
      r.checks[1] = { name: 'rows.b_absent', passed: true, reason };
      expect(drillReportSchema.safeParse(r).success, reason).toBe(false);
    }
  });

  it('lists every check in the Markdown summary', () => {
    const md = reportMarkdown(report());
    for (const name of DRILL_CHECKS) expect(md).toContain(`| ${name} | pass |`);
    expect(md).toContain('120.8 MB/min');
  });

  it('builds a valid failure report when the restore fails, every check failed', () => {
    const failed = failedRestoreReport({
      date: '2026-11-11T14:27:22.623Z',
      targetTime: '2026-11-11T14:27:05.389697Z',
      restoreSeconds: 12.5,
      maxRestoreMinutes: 15,
      failure:
        "pgBackRest error [075]: unable to find backup set with stop time less than '2026-11-11 14:27:05+00'",
    });
    expect(drillReportSchema.safeParse(failed).success).toBe(true);
    expect(failed.checks.every((c) => !c.passed)).toBe(true);
    expect(reportMarkdown(failed)).toContain('# Restore drill FAILED');
    const leaky = failedRestoreReport({ ...failed, failure: 'postgres://u:pw@127.0.0.1:5432/x' });
    expect(leaky.checks.at(-1)?.reason).toBe('restore failed (message withheld)');
  });

  it('measures the rate in MB per minute', () => {
    expect(restoreRate(30.2, 15)).toBe(120.8);
    expect(restoreRate(10, 0)).toBe(0);
  });
});
