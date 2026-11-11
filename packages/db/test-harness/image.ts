// Container images for DB tests, pinned by digest (tag kept for readability). Debian (glibc +
// ICU) like production, so collation and sorting of Arabic text behave the same.
// Update both together: tag and digest from Docker Hub, image at least 24 hours old.
export const POSTGRES_IMAGE =
  'postgres:18.6-trixie@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42';

// PgBouncer between shifa_app and PostgreSQL (0.3-S2). The image is only a carrier for the
// `pgbouncer` binary: the harness bypasses its entrypoint and mounts its own pgbouncer.ini and
// userlist.txt (no image-specific env vars), so another image with the same binary drops in.
export const PGBOUNCER_IMAGE =
  'edoburu/pgbouncer:v1.26.1-p0@sha256:488422e38cff912895d0d65d8963fcd306e6ac589a724398b6eb8e294e94d624';

// Testcontainers' reaper (removes the container if a run crashes). testcontainers 12.2.1 uses
// ryuk 0.14.0; pinned here and passed as RYUK_CONTAINER_IMAGE.
export const RYUK_IMAGE =
  'testcontainers/ryuk:0.14.0@sha256:7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0';
