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
  action text not null check (action in ('search', 'retrieve', 'store')),
  route_class text not null,
  status integer not null
);

-- The gateway appends; it never reads, changes or deletes audit rows.
grant usage on schema s4 to s4_gateway;
grant insert on s4.audit to s4_gateway;
