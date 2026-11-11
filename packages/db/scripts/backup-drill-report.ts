// The restore drill's report (spec 0.2-09c criteria 7 and 8): `.verify/backup-drill/report.json`
// and `report.md`. Versions, label, target time, duration, size, rate and each check's verdict;
// no row values, no connection strings. The schema is strict, so an extra field fails.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Every check the drill runs, in report order. */
export const DRILL_CHECKS = [
  'rows.baseline_and_a',
  'rows.b_absent',
  'migrations.journal',
  'rls.presence',
  'roles.app_not_owner',
  'restore.duration',
] as const;

/** Reasons are counts and names; this catches a value or URL that slipped into one. */
const SAFE_REASON = /^[\w .,;:()<>=%/'"-]*$/u;
const FORBIDDEN = /postgres(ql)?:\/\/|password|@[\w.-]+:\d+/i;

export const drillCheckSchema = z.strictObject({
  name: z.enum(DRILL_CHECKS),
  passed: z.boolean(),
  reason: z
    .string()
    .max(400)
    .regex(SAFE_REASON, 'reason has characters outside counts and names')
    .refine((r) => !FORBIDDEN.test(r), 'reason looks like a connection string or secret'),
});

export const drillReportSchema = z
  .strictObject({
    date: z.iso.datetime(),
    postgresVersion: z.string().min(1),
    pgbackrestVersion: z.string().min(1),
    // `none` when the restore failed before a backup set was chosen.
    backupLabel: z.string().regex(/^(none|\d{8}-\d{6}[FDI](_\d{8}-\d{6}[DI])?)$/),
    targetTime: z.string().min(1),
    restoreSeconds: z.number().nonnegative(),
    restoredMegabytes: z.number().nonnegative(),
    rateMegabytesPerMinute: z.number().nonnegative(),
    maxRestoreMinutes: z.number().positive(),
    passed: z.boolean(),
    checks: z.array(drillCheckSchema),
  })
  .refine(
    (r) =>
      r.checks.length === DRILL_CHECKS.length &&
      DRILL_CHECKS.every((n) => r.checks.some((c) => c.name === n)),
    'the report must list every drill check exactly once',
  )
  .refine(
    (r) => r.passed === r.checks.every((c) => c.passed),
    'passed must equal all checks passed',
  );

export type DrillReport = z.infer<typeof drillReportSchema>;

/**
 * The report for a restore that failed or timed out: every check failed, the failure line (one
 * line from scripts/lib/backup-faults.mjs, characters outside the safe set blanked) as reason.
 */
export function failedRestoreReport(input: {
  date: string;
  targetTime: string;
  restoreSeconds: number;
  maxRestoreMinutes: number;
  failure: string;
}): DrillReport {
  const failure = input.failure.replace(/[^\w .,;:()<>=%/'"-]/gu, ' ').slice(0, 300);
  const reason = FORBIDDEN.test(failure) ? 'restore failed (message withheld)' : failure;
  return {
    date: input.date,
    postgresVersion: 'unknown',
    pgbackrestVersion: 'unknown',
    backupLabel: 'none',
    targetTime: input.targetTime,
    restoreSeconds: input.restoreSeconds,
    restoredMegabytes: 0,
    rateMegabytesPerMinute: 0,
    maxRestoreMinutes: input.maxRestoreMinutes,
    passed: false,
    checks: DRILL_CHECKS.map((name) => ({
      name,
      passed: false,
      reason: name === 'restore.duration' ? reason : 'not run: the restore failed',
    })),
  };
}

/** MB per minute of restore (restore + recovery + promotion), one decimal. */
export function restoreRate(megabytes: number, seconds: number): number {
  return seconds > 0 ? Math.round((megabytes / (seconds / 60)) * 10) / 10 : 0;
}

export function reportMarkdown(report: DrillReport): string {
  const lines = [
    `# Restore drill ${report.passed ? 'passed' : 'FAILED'}`,
    '',
    `- Date: ${report.date}`,
    `- PostgreSQL ${report.postgresVersion}, pgBackRest ${report.pgbackrestVersion}`,
    `- Backup set: ${report.backupLabel}; target time: ${report.targetTime}`,
    `- Restore: ${String(report.restoreSeconds)} s for ${String(report.restoredMegabytes)} MB ` +
      `(${String(report.rateMegabytesPerMinute)} MB/min; limit ${String(report.maxRestoreMinutes)} min)`,
    '',
    '| Check | Result | Reason |',
    '|---|---|---|',
    ...report.checks.map((c) => `| ${c.name} | ${c.passed ? 'pass' : 'FAIL'} | ${c.reason} |`),
    '',
  ];
  return lines.join('\n');
}

/** Validates, then writes both files under `<root>/.verify/backup-drill/`; returns the dir. */
export function writeReport(root: string, report: DrillReport): string {
  const parsed = drillReportSchema.parse(report);
  const dir = join(root, '.verify', 'backup-drill');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), `${JSON.stringify(parsed, null, 2)}\n`);
  writeFileSync(join(dir, 'report.md'), reportMarkdown(parsed));
  return dir;
}
