// `pnpm backup:check` (spec 0.2-09c criterion 4): `pgbackrest check`, `pgbackrest info` and the
// archiver statistics. Exit 1 when archiving is broken, there is no backup, or the newest backup
// is older than the schedule allows. Prints the backup labels and the newest archived WAL only.
import { ENV_PATH, pgbackrest, psql, readEnv, readSchedule } from './backup-env.mjs';
import { classifyFailure as classify } from './backup-faults.mjs';

/** The fault line without the restore wording (`check` restores nothing). */
const classifyFailure = (output) => classify(output)?.replace(/^restore failed: /, '');

/** Newest archived WAL, its time and the last failure's time, as ISO UTC (seconds). */
export const ARCHIVER_QUERY =
  "select coalesce(last_archived_wal, ''), coalesce(to_char(last_archived_time at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), ''), " +
  "coalesce(to_char(last_failed_time at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), '') from pg_stat_archiver";

const iso = (seconds) => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');

/** Backups of the stanza from `pgbackrest info --output=json`, oldest first. */
export function backupsOf(info) {
  const stanza = Array.isArray(info) ? info[0] : undefined;
  return (stanza?.backup ?? [])
    .map((b) => ({
      type: b.type,
      label: b.label,
      start: b.timestamp?.start,
      stop: b.timestamp?.stop,
      size: b.info?.size,
    }))
    .filter((b) => typeof b.label === 'string' && Number.isFinite(b.stop))
    .sort((a, b) => a.stop - b.stop);
}

/** `last_archived_wal|last_archived_time|last_failed_time` → object, or undefined. */
export function parseArchiver(stdout) {
  const line =
    String(stdout ?? '')
      .trim()
      .split(/\r?\n/)[0] ?? '';
  const [wal, archived, failed] = line.split('|');
  if (!wal) return undefined;
  return { wal, archived: archived || undefined, failed: failed || undefined };
}

/**
 * The verdict from collected facts (pure, for the tests). `check` is the result of
 * `pgbackrest check`; `info` the parsed JSON (or undefined); `archiver` from parseArchiver.
 */
export function evaluateCheck({ check, info, archiver, now, maxBackupAgeHours }) {
  const lines = [];
  const failures = [];
  if (check.code !== 0) {
    failures.push(`check failed: ${classifyFailure(check.output) ?? 'WAL archiving is broken'}`);
  }
  const stanza = Array.isArray(info) ? info[0] : undefined;
  if (info !== undefined && stanza?.status?.code !== 0 && stanza?.status?.code !== 2) {
    // 2 is "no valid backups"; that case is reported below.
    const reason =
      classifyFailure(stanza?.repo?.[0]?.status?.message ?? '') ?? 'repository status not ok';
    failures.push(`check failed: ${reason}`);
  }
  const backups = backupsOf(info);
  for (const b of backups) lines.push(`backup ${b.type} ${b.label} stopped ${iso(b.stop)}`);
  if (archiver) {
    lines.push(`newest WAL ${archiver.wal} archived ${archiver.archived ?? 'at an unknown time'}`);
    if (archiver.failed && (!archiver.archived || archiver.failed > archiver.archived)) {
      failures.push(`check failed: WAL archiving has failed since ${archiver.failed}`);
    }
  } else {
    lines.push('newest WAL: none archived');
  }
  const newest = backups.at(-1);
  if (!newest) {
    failures.push('check failed: no backup in the repository (run pnpm backup:full)');
  } else {
    const ageHours = (now.getTime() / 1000 - newest.stop) / 3600;
    if (ageHours > maxBackupAgeHours) {
      failures.push(
        `check failed: newest backup is ${ageHours.toFixed(1)} h old (schedule allows ${maxBackupAgeHours} h)`,
      );
    }
  }
  const unique = [...new Set(failures)];
  return {
    code: unique.length > 0 ? 1 : 0,
    lines: [...lines, ...(unique.length > 0 ? unique : ['check: ok'])],
  };
}

export async function check(io) {
  if (readEnv(io) === undefined) {
    io.out(`backup: no ${ENV_PATH}; run pnpm backup:up first`);
    return 1;
  }
  const quiet = { capture: true, captureErr: true };
  const checked = await io.run('docker', pgbackrest(io, 'check'), quiet);
  const infoRun = await io.run('docker', pgbackrest(io, 'info', '--output=json'), quiet);
  let info;
  try {
    info = infoRun.code === 0 ? JSON.parse(infoRun.stdout) : undefined;
  } catch {
    info = undefined;
  }
  const archiverRun = await io.run('docker', psql(io, ARCHIVER_QUERY), quiet);
  const verdict = evaluateCheck({
    check: { code: checked.code, output: `${checked.stdout}\n${checked.stderr}` },
    info,
    archiver: archiverRun.code === 0 ? parseArchiver(archiverRun.stdout) : undefined,
    now: io.now(),
    maxBackupAgeHours: readSchedule(io).maxBackupAgeHours,
  });
  for (const line of verdict.lines) io.out(line);
  return verdict.code;
}
