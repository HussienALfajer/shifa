# Backups and restore (PLT-51)

How Shifa's PostgreSQL is backed up and restored to a point in time, locally and later in production. Targets (ADR-0029): data loss at most **5 minutes** (RPO), restore within **4 hours** (RTO). Spec: [0.2-09c](../specs/foundation/0.2-09c-backups-and-restore-drill.md); slice: [0.2-09c](../slices/0.2-09c-backups-and-restore-drill.md).

The local stack holds synthetic data only (PLT-50). Production uses the same scripts and configuration once hosting is chosen (OD-01).

## Architecture

```
PostgreSQL 18 ── archive_command: pgbackrest archive-push (every WAL segment, at least every 60 s)
   │             backup: pgbackrest --type=full|diff (online, consistent)
   ▼
pgBackRest ── encrypts (aes-256-cbc) and compresses (zstd) before anything leaves the host
   │  HTTPS, certificate verified against the stack's CA
   ▼
garage-tls (Caddy, `tls internal`) ──► Garage S3 API, bucket `shifa-backup`
                                       key `shifa-pgbackrest`: read + write on that bucket only
```

| Piece | Where |
|---|---|
| Compose stack (`shifa-backup`): `postgres`, `garage`, `garage-tls` | `infra/backup/compose.yml` |
| PostgreSQL 18 + pgBackRest image (harness digest, pgBackRest pinned exactly) | `infra/backup/postgres/Dockerfile` |
| pgBackRest settings (no secrets) | `infra/backup/pgbackrest/pgbackrest.conf` |
| Schedule and retention | `infra/backup/schedule.json` |
| Secrets (generated, owner-only, git-ignored) | `infra/backup/.env` |
| Scripts | `scripts/backup.mjs`, `scripts/lib/backup*.mjs` |
| Restore drill | `packages/db/scripts/backup-drill*.ts`, `.github/workflows/backup-drill.yml` |

pgBackRest reads the S3 key, its secret and the passphrase from the container environment (`PGBACKREST_REPO1_S3_KEY`, `PGBACKREST_REPO1_S3_KEY_SECRET`, `PGBACKREST_REPO1_CIPHER_PASS`), never from a file in the repository and never from a command line. Its logs show them as `<redacted>`.

## Schedule and retention

From `infra/backup/schedule.json` (UTC):

| What | When | Command |
|---|---|---|
| Full backup | Sunday 02:00 | `pnpm backup:full` |
| Differential backup | Monday–Saturday 02:00 | `pnpm backup:diff` |
| WAL | continuous; a segment is shipped at least every 60 s (`archive_timeout`) | PostgreSQL `archive_command` |
| Retention | full backups kept 30 days (`repo1-retention-full-type=time`); older WAL expires with them | after every backup |
| Freshness | `backup:check` fails when the newest backup is older than 26 h | monitoring (later) |

Locally nothing runs on a timer; the production scheduler (systemd timer or cron on the database host) calls the commands above.

## Commands

All need Docker. On Windows run them from Git Bash or PowerShell in `D:\shifa`; in the sandboxed WSL2 session Docker is blocked (OD-24).

```bash
pnpm backup:up        # start; first run writes infra/backup/.env and bootstraps Garage
pnpm backup:full      # full backup now
pnpm backup:diff      # differential backup now
pnpm backup:check     # archiving works, newest backup fresh; prints labels and newest WAL
pnpm backup:restore --target-time 2026-11-11T14:00:00Z   # point in time; omit for the latest
pnpm backup:drill     # the whole drill on a fresh stack (deletes the local stack first)
pnpm backup:down      # stop, keep data
pnpm backup:reset --yes   # delete database, backups, restores and the .env
```

PostgreSQL listens on `127.0.0.1:55432` (user `postgres`, password `BACKUP_POSTGRES_PASSWORD` in the `.env`). Nothing else is published.

## Restore to a point in time

1. `pnpm backup:check` — note the oldest backup and the newest archived WAL time: the valid range.
2. `pnpm backup:restore --target-time <ISO time with zone>` (e.g. `2026-11-11T14:00:00Z`). The script:
   - refuses a target outside the range (exit 2) and prints the range;
   - creates a new volume and container `shifa-backup-restore-<timestamp>` and refuses (exit 2) if its data directory is not empty;
   - runs `pgbackrest restore --type=time --target=<T> --target-action=promote` in a separate container, so it works while the source is down and never touches the source's volumes;
   - starts PostgreSQL with `archive_mode=off` (a restored copy must never push a new timeline into the source's repository), waits for promotion and prints the backup set, target, port and duration.
3. Connect to the printed port, check the data, then switch the application over (production: change the connection string and restart; see the quarterly drill).
4. Remove the copy when done: `docker rm -f <container>` and `docker volume rm <container>` (or `backup:reset --yes` locally).

Errors are one line each: `restore failed: repository passphrase rejected`, `restore failed: WAL segment <name> missing from the archive`, `repository unreachable at garage-tls:443`; anything else passes through as `pgBackRest error [<code>]: <message>`.

## The restore drill

`pnpm backup:drill` resets and starts the stack, applies `roles.sql` and the migrations, writes 500 baseline rows of synthetic data (`@shifa/testing`) into `drill.rows`, takes a full backup, writes batch A, records T from the database clock, writes batch B, switches WAL and waits until it is archived, restores to T, and checks:

| Check | Passes when |
|---|---|
| `rows.baseline_and_a` | count and md5 of the canonical rows written before T are equal on source and restore |
| `rows.b_absent` | no row written after T exists |
| `migrations.journal` | Drizzle's migration journal is identical |
| `rls.presence` | the 0.2-06b presence check finds no violation on the restore (ENABLE + FORCE RLS, policies, classification) |
| `roles.app_not_owner` | `shifa_app` is not superuser, has no `BYPASSRLS`, owns nothing |
| `restore.duration` | the restore took less than 15 minutes |

It writes `.verify/backup-drill/report.json` and `report.md` (versions, backup set, target time, duration, size, rate, each check; no row values, no connection strings) and exits 1 if any check fails. `--keep` leaves the restored container running.

`pnpm backup:drill --self-test wrong-passphrase|missing-wal|garage-down` injects one fault before the restore (another passphrase; one archived segment removed through the stack's own key; the TLS proxy stopped) and passes only if the drill fails with that fault's message.

CI runs the drill and the three self-tests every Monday 03:00 UTC and on manual dispatch (`.github/workflows/backup-drill.yml`); the report is an artifact kept 90 days. Secrets are generated and masked in the job; the workflow reads no repository secrets. GitHub disables scheduled workflows after 60 days without repository activity: re-enable it under Actions if that happens.

### Checking the 4-hour RTO

The report's rate (MB/min) covers restore, WAL replay and promotion. For production:

```
restore time ≈ production database size (MB) ÷ rate (MB/min) + WAL replay margin
```

Use the rate from a drill on the production hardware (the local rate on a 30 MB database is dominated by fixed start-up time, so it says little about a large one), and a WAL replay margin of at least the time to replay one day of WAL (the differential runs daily). The sum must stay under 4 hours; when it approaches 2 hours, raise backup frequency or restore parallelism (`process-max`) before it becomes a problem.

## Rotating the passphrase

pgBackRest cannot re-encrypt an existing repository. Rotate by starting a new repository:
1. Generate a new passphrase (32 random bytes, hex) and store it where production keeps secrets (Infisical, later) and in the owner's offline copy.
2. Point a new repository path (or `repo2`) at it, run `stanza-create` and a full backup.
3. Keep the old repository and its passphrase until its newest backup is older than the retention (30 days), then delete both.

## Losing the passphrase

Losing `BACKUP_CIPHER_PASS` makes every backup in that repository unreadable. Production keeps it in the secret store (Infisical, later) and the owner keeps an offline copy. Locally, `backup:reset --yes` and start again.

## Off-site second repository (`repo2`, blocked by OD-01)

PLT-51 needs a copy at a second provider. `pgbackrest.conf` carries a commented `repo2-*` block: once OD-01 names the provider, fill the endpoint, bucket and region, give it its own key and passphrase through `PGBACKREST_REPO2_*` environment variables, run `stanza-create`, and every backup and WAL segment goes to both repositories. `backup:check` then covers both.

## Quarterly production drill

Every quarter, on production (after OD-01):
1. Pick T = a recent time; restore to it on a separate host with `pnpm backup:restore --target-time <T>`.
2. Run the drill's checks against the restore: row counts of a few tenant tables against the source at T, the migration journal, `rls.presence`, `roles.app_not_owner`.
3. Record the duration and rate, recompute the RTO estimate above, and file the report next to the CI ones.
4. Remove the restored copy.

## Not backed up yet

- Object storage (Garage attachments) and Orthanc (images): later slices.
- Alerts on a failed archive or a stale backup: with the alerting of 0.2-09b's follow-up.

## Updating images

Pinned by version and digest. Read new values with `docker buildx imagetools inspect <image>:<version>`; the pgBackRest version with `apt-cache policy pgbackrest` in the base image. The PostgreSQL base must stay equal to `packages/db/test-harness/image.ts` (a script test checks it). When PGDG drops the pinned pgBackRest version the build fails: bump the pin and the image tag (`POSTGRES_IMAGE_TAG` in `scripts/lib/backup-env.mjs`) in one PR.
