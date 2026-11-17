-- Spike 0.3-S5 state, in its own database (`s5_messaging` in the stack, one per test in the
-- suites), never in packages/db/migrations. Rows carry clinic_id but no RLS, as in 0.3-S4:
-- throwaway code. Phone numbers and message bodies live only here, never in logs.
create schema if not exists s5;

create table if not exists s5.session (
  name text primary key,
  container text not null,
  clinic_id text,
  role text not null check (role in ('clinic', 'platform')),
  time_zone text not null,
  waha_status text not null default 'WORKING',
  gateway_down boolean not null default false,
  paused_until timestamptz,
  needs_admin_resume boolean not null default false,
  health text not null default 'linked' check (health in ('linked', 'needs_qr', 'paused', 'down')),
  last_ok_at timestamptz,
  not_seen_alerted boolean not null default false,
  created_at timestamptz not null
);

create table if not exists s5.patient (
  clinic_id text not null,
  patient_id text not null,
  phone text not null,
  primary key (clinic_id, patient_id)
);
create index if not exists patient_phone on s5.patient (clinic_id, phone);

-- Opt-in (MSG-13) and opt-out (MSG-14) per (clinic, patient). state_at is the timestamp of the
-- inbound message that set opted_out, so an older message arriving late cannot undo it.
create table if not exists s5.optin (
  clinic_id text not null,
  patient_id text not null,
  last_inbound_at timestamptz,
  opted_out boolean not null default false,
  state_at timestamptz not null,
  primary key (clinic_id, patient_id)
);

create table if not exists s5.delivery_attempt (
  id uuid primary key,
  seq bigserial unique,
  clinic_id text not null,
  patient_id text not null,
  -- The number the message was queued for; the send goes there only if it is still the
  -- patient's number and on the allowlist.
  phone text not null,
  session text not null references s5.session (name),
  template_key text not null,
  variant int not null,
  body text not null,
  confirmation boolean not null default false,
  status text not null check (
    status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'unknown', 'dropped', 'fallback')
  ),
  reason text,
  error_code text,
  wa_message_id text unique,
  worker text,
  created_at timestamptz not null,
  sending_at timestamptz,
  send_called_at timestamptz,
  sent_at timestamptz,
  updated_at timestamptz not null
);
create index if not exists attempt_queue on s5.delivery_attempt (session, status, seq);

-- Stand-in for the in-app inbox (out of scope): one row per message that fell back.
create table if not exists s5.inbox (
  id bigserial primary key,
  clinic_id text not null,
  patient_id text not null,
  attempt_id uuid not null unique references s5.delivery_attempt (id),
  created_at timestamptz not null
);

-- Reception's "send manually" task with a prefilled wa.me link (MSG-16).
create table if not exists s5.manual_task (
  id bigserial primary key,
  clinic_id text not null,
  patient_id text not null,
  attempt_id uuid not null unique references s5.delivery_attempt (id),
  link text not null,
  maybe_sent boolean not null,
  created_at timestamptz not null
);

create table if not exists s5.admin_alert (
  id bigserial primary key,
  clinic_id text,
  session text not null,
  kind text not null,
  created_at timestamptz not null
);

create table if not exists s5.webhook_seen (
  container text not null,
  key text not null,
  seen_at timestamptz not null,
  primary key (container, key)
);

create table if not exists s5.refusal (
  id bigserial primary key,
  clinic_id text not null,
  template_key text not null,
  reason text not null,
  created_at timestamptz not null
);
