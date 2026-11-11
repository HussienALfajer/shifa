# PostgreSQL 18 with pgBackRest for the local backup stack (spec 0.2-09c). The base is the DB
# test harness image (packages/db/test-harness/image.ts): update both digests together.
# pgBackRest comes from the PGDG apt repository the official image already configures; the
# version is exact, so a version PGDG drops fails the build loudly (bump it in a PR).
FROM postgres:18.6-trixie@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42

RUN apt-get update \
  && apt-get install -y --no-install-recommends pgbackrest=2.60.0-1.pgdg13+1 \
  && rm -rf /var/lib/apt/lists/* \
  && install -d -o postgres -g postgres -m 0750 /var/log/pgbackrest /var/lib/pgbackrest /tmp/pgbackrest
