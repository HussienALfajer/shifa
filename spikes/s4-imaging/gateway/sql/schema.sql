-- Spike state of the imaging gateway (0.3-S4): its own database `s4_gateway` on the stack's
-- PostgreSQL, created by the harness, never in packages/db/migrations. The gateway is the only
-- client and takes the tenant from the verified token on every query. These tables are not
-- reached through withTenant(), so they carry tenant_id but no RLS; Phase D moves imaging
-- audit into the main audit log (IMG-25).
create schema s4;

create table s4.audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  tenant_id text not null,
  study_uid text,
  action text not null check (action in ('search', 'retrieve', 'store', 'upload', 'push')),
  route_class text not null,
  status integer not null
);

-- Chunked upload sessions (0.3-S4b): one per tenant and folder manifest. Offsets only; the
-- bytes are on the gateway's disk, named by session id and file index.
create table s4.upload_session (
  id text primary key,
  tenant_id text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table s4.upload_file (
  upload_id text not null references s4.upload_session (id),
  idx integer not null,
  path text not null,
  size bigint not null check (size > 0),
  sha256 text not null,
  received bigint not null default 0 check (received >= 0 and received <= size),
  state text not null default 'pending' check (state in ('pending', 'done', 'skipped')),
  primary key (upload_id, idx)
);

-- One-time viewer codes already exchanged (0.3-S4b): a jti works once.
create table s4.viewer_code (
  jti text primary key,
  used_at timestamptz not null default now()
);

-- The gateway appends audit rows; it never reads, changes or deletes them.
grant usage on schema s4 to s4_gateway;
grant insert on s4.audit to s4_gateway;
grant select, insert, update on s4.upload_session, s4.upload_file to s4_gateway;
grant insert on s4.viewer_code to s4_gateway;
