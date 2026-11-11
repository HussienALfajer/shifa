// The restore drill (spec 0.2-09c criteria 6–8, 10). Run by `pnpm backup:drill`
// (scripts/backup.mjs), which resets and starts the local backup stack first and passes the
// connection details in this process's environment only. Synthetic data only (PLT-50): rows
// come from @shifa/testing, and the drill connects to nothing but its own containers.
//
// Steps: roles and migrations → baseline rows → full backup → batch A → T (database clock) →
// batch B → WAL switch, wait until archived → restore to T in a new container → checks →
// report. With BACKUP_DRILL_SELF_TEST=<fault> the fault is injected before the restore and the
// drill only reports whether the restore failed (scripts/lib/backup-faults.mjs decides).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { sql } from 'drizzle-orm';
import { migrate, ROLES_SQL } from '../src/migrate.ts';
import { TABLE_CLASSIFICATION } from '../src/schema/classification.ts';
import {
  type CheckResult,
  checkAbsent,
  checkAppRole,
  checkRls,
  compareJournal,
  compareRows,
  withCatalog,
} from './backup-drill-checks.ts';
import {
  type DrillReport,
  failedRestoreReport,
  reportMarkdown,
  restoreRate,
  writeReport,
} from './backup-drill-report.ts';

type Catalog = Parameters<Parameters<typeof withCatalog>[1]>[0];

const ROOT = join(import.meta.dirname, '..', '..', '..');
const BACKUP_SCRIPT = join(ROOT, 'scripts', 'backup.mjs');
const DATABASE = 'shifa';
const SEED = 20261111;
const SIZES = { baseline: 500, a: 200, b: 200 } as const;
export const FAULT_MARKER = 'DRILL_FAULT_INJECTED';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run this through pnpm backup:drill`);
  return value;
}

const port = Number(required('BACKUP_DRILL_PORT'));
// Only the local backup stack (infra/backup/compose.yml): never another PostgreSQL on this host.
if (port !== 55432) throw new Error('BACKUP_DRILL_PORT must be 55432 (the local backup stack)');
const password = required('BACKUP_DRILL_PASSWORD');
const selfTest = process.env['BACKUP_DRILL_SELF_TEST'] ?? '';
const keep = process.env['BACKUP_DRILL_KEEP'] === '1';
const maxRestoreMinutes = Number(process.env['BACKUP_DRILL_MAX_RESTORE_MINUTES'] ?? '15');

const url = (user: string, pw: string, p: number, db: string) =>
  `postgres://${user}:${encodeURIComponent(pw)}@127.0.0.1:${String(p)}/${db}`;
const superuser = (db: string, p = port) => url('postgres', password, p, db);

interface Run {
  code: number;
  stdout: string;
}

/** Runs a child from an argument array; `capture` keeps stdout instead of showing it. */
function run(
  cmd: string,
  args: string[],
  options: { capture?: boolean; env?: NodeJS.ProcessEnv } = {},
): Promise<Run> {
  return new Promise((done) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', options.capture ? 'pipe' : 'inherit', 'inherit'],
    });
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.once('error', () => {
      done({ code: 1, stdout });
    });
    child.once('close', (code) => {
      done({ code: code ?? 1, stdout });
    });
  });
}

const backupCli = (args: string[], options?: Parameters<typeof run>[2]) =>
  run(process.execPath, [BACKUP_SCRIPT, ...args], options);

async function one<T>(db: Catalog, query: ReturnType<typeof sql>): Promise<T> {
  const { rows } = await db.execute<Record<string, T>>(query);
  return Object.values(rows[0] ?? {})[0] as T;
}

/** Roles, the database, migrations as the owner, then the drill table. */
async function prepare(): Promise<void> {
  const ownerPassword = randomBytes(16).toString('hex');
  await withCatalog(superuser('postgres'), async (db) => {
    await db.execute(sql.raw(readFileSync(ROLES_SQL, 'utf8')));
    await db.execute(sql.raw(`ALTER ROLE shifa_owner LOGIN PASSWORD '${ownerPassword}'`));
    await db.execute(sql.raw(`CREATE DATABASE ${DATABASE} OWNER shifa_owner`));
  });
  await migrate(url('shifa_owner', ownerPassword, port, DATABASE));
  await withCatalog(superuser(DATABASE), async (db) => {
    await db.execute(sql`create schema drill`);
    await db.execute(sql`create table drill.rows (
      id uuid primary key, batch text not null, payload jsonb not null, created_at timestamptz not null)`);
  });
}

/** Synthetic rows: a name and a phone from the seeded generator, one random stream per batch. */
async function insertBatch(db: Catalog, batch: string, count: number): Promise<void> {
  const random = createRandom(SEED).fork(batch);
  const payload = Array.from({ length: count }, (_, i) => {
    const r = random.fork(String(i));
    const name = generatePersonName(r.fork('name'), {
      sex: i % 2 === 0 ? 'female' : 'male',
      adult: true,
      region: 'aleppo',
    });
    return { name: fullName(name), phone: generatePhone(r.fork('phone'), 'SY'), visits: i % 7 };
  });
  await db.execute(sql`
    insert into drill.rows (id, batch, payload, created_at)
    select gen_random_uuid(), ${batch}, value, clock_timestamp()
      from jsonb_array_elements(${JSON.stringify(payload)}::jsonb)`);
}

/** Writes batch B, switches WAL and waits until that segment is in the repository. */
async function writeAndArchive(db: Catalog): Promise<{ target: string; segmentA: string }> {
  // pgBackRest records a backup's stop time in whole seconds, rounded up past the moment the
  // backup returns: T must lie clearly after it, or no backup set counts as "before T".
  await db.execute(sql`select pg_sleep(2)`);
  await insertBatch(db, 'a', SIZES.a);
  const segmentA = await one<string>(db, sql`select pg_walfile_name(pg_current_wal_lsn())`);
  const target = await one<string>(
    db,
    sql`select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  );
  await db.execute(sql`select pg_sleep(1)`);
  await insertBatch(db, 'b', SIZES.b);
  const switched = await one<string>(db, sql`select pg_walfile_name(pg_switch_wal())`);
  for (let i = 0; i < 120; i++) {
    const archived = await one<string | null>(
      db,
      sql`select last_archived_wal from pg_stat_archiver`,
    );
    if (archived !== null && archived >= switched) return { target, segmentA };
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`WAL segment ${switched} was not archived within 120 s`);
}

interface Restored {
  container: string;
  label: string;
  port: number;
  durationSeconds: number;
  sizeBytes: number;
  pgbackrestVersion: string;
}

async function restoreTo(
  target: string,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; result: Restored | undefined; failure: string }> {
  const args = [
    'restore',
    '--target-time',
    target,
    '--json',
    '--timeout-minutes',
    String(maxRestoreMinutes),
  ];
  const restored = await backupCli(keep ? [...args, '--keep'] : args, { capture: true, env });
  let result: Restored | undefined;
  let failure = 'restore failed';
  for (const line of restored.stdout.split(/\r?\n/)) {
    if (line.startsWith('{')) result = JSON.parse(line) as Restored;
    else if (line.trim()) {
      process.stdout.write(`${line}\n`);
      failure = line.trim();
    }
  }
  return { code: restored.code, result, failure };
}

async function injectFault(segmentA: string): Promise<NodeJS.ProcessEnv> {
  if (selfTest === 'wrong-passphrase') {
    process.stdout.write(`${FAULT_MARKER} wrong-passphrase\n`);
    return { BACKUP_CIPHER_PASS: randomBytes(32).toString('hex') };
  }
  const args =
    selfTest === 'missing-wal' ? ['fault', 'missing-wal', segmentA] : ['fault', 'garage-down'];
  const injected = await backupCli(args);
  if (injected.code !== 0) throw new Error(`could not inject ${selfTest}`);
  process.stdout.write(
    `${FAULT_MARKER} ${selfTest} ${selfTest === 'missing-wal' ? segmentA : ''}\n`,
  );
  return {};
}

async function main(): Promise<number> {
  await prepare();
  await withCatalog(superuser(DATABASE), (db) => insertBatch(db, 'baseline', SIZES.baseline));
  if ((await backupCli(['full'])).code !== 0) return 1;
  const { target, segmentA } = await withCatalog(superuser(DATABASE), writeAndArchive);
  process.stdout.write(`drill: target time ${target}\n`);

  const env = selfTest ? await injectFault(segmentA) : {};
  const started = Date.now();
  const { code, result, failure } = await restoreTo(target, env);
  if (selfTest) return code === 0 ? 0 : 1;
  if (code !== 0 || !result) {
    // The weekly artifact must show this failure too, not only the passing runs.
    const report = failedRestoreReport({
      date: new Date().toISOString(),
      targetTime: target,
      restoreSeconds: Math.round((Date.now() - started) / 100) / 10,
      maxRestoreMinutes,
      failure,
    });
    const dir = writeReport(ROOT, report);
    process.stdout.write(`${reportMarkdown(report)}\ndrill: report in ${dir}\n`);
    return 1;
  }

  const restoredUrl = superuser(DATABASE, result.port);
  const checks: CheckResult[] = await withCatalog(superuser(DATABASE), (source) =>
    withCatalog(restoredUrl, async (restored) => [
      await compareRows(source, restored, ['baseline', 'a']),
      await checkAbsent(restored, 'b'),
      await compareJournal(source, restored),
      await checkRls(restored, TABLE_CLASSIFICATION),
      await checkAppRole(restored),
    ]),
  );
  const withinLimit = result.durationSeconds <= maxRestoreMinutes * 60;
  checks.push({
    name: 'restore.duration',
    passed: withinLimit,
    reason: `${String(result.durationSeconds)} s (limit ${String(maxRestoreMinutes)} min)`,
  });
  const postgresVersion = await withCatalog(restoredUrl, (db) =>
    one<string>(db, sql`show server_version`),
  );
  const megabytes = Math.round((result.sizeBytes / 1024 / 1024) * 10) / 10;
  const report: DrillReport = {
    date: new Date().toISOString(),
    postgresVersion,
    pgbackrestVersion: result.pgbackrestVersion,
    backupLabel: result.label,
    targetTime: target,
    restoreSeconds: result.durationSeconds,
    restoredMegabytes: megabytes,
    rateMegabytesPerMinute: restoreRate(megabytes, result.durationSeconds),
    maxRestoreMinutes,
    passed: checks.every((c) => c.passed),
    checks,
  };
  const dir = writeReport(ROOT, report);
  process.stdout.write(`${reportMarkdown(report)}\ndrill: report in ${dir}\n`);
  if (!keep) {
    await run('docker', ['rm', '-f', result.container], { capture: true });
    await run('docker', ['volume', 'rm', '-f', result.container], { capture: true });
  }
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (err) {
  // Name and SQLSTATE only: a driver or Drizzle message can quote the failed SQL (the owner's
  // password statement) or a `detail` with values. Our own errors are plain Error with a
  // fixed message and are shown as they are.
  const cause = err instanceof Error ? (err.cause as { code?: unknown } | undefined) : undefined;
  const ours = err instanceof Error && err.constructor === Error && cause === undefined;
  const line = ours
    ? err.message
    : `${err instanceof Error ? err.name : 'error'}${typeof cause?.code === 'string' ? ` (SQLSTATE ${cause.code})` : ''}`;
  process.stderr.write(`drill: failed: ${line}\n`);
  process.exitCode = 1;
}
