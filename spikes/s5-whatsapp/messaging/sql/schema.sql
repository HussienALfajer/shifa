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

-- Reverse verification (0.3-S5b, criterion 9). A nonce is bound to a device and the claimed
-- number; the code and the number are stored only as HMAC(serverKey, ...) keys, the device secret
-- only as its SHA-256. Attempts carry keys, never numbers.
create table if not exists s5.verify_nonce (
  id text primary key,
  device_id text not null,
  phone_key text not null,
  code_hash text not null unique,
  secret_hash text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  verified_at timestamptz
);
create index if not exists verify_nonce_device on s5.verify_nonce (device_id, created_at);
create index if not exists verify_nonce_phone on s5.verify_nonce (phone_key, created_at);

create table if not exists s5.verify_attempt (
  id bigserial primary key,
  nonce_id text references s5.verify_nonce (id),
  device_id text,
  sender_key text,
  claimed_key text,
  outcome text not null check (
    outcome in ('verified', 'expired', 'wrong_device', 'sender_mismatch', 'reused', 'rate_limited', 'lid_unresolved', 'no_match')
  ),
  created_at timestamptz not null
);
create index if not exists verify_attempt_time on s5.verify_attempt (created_at);

-- Inbound messages on the platform session: the only thing a platform message may reply to
-- (MSG-22). chat_id is where the reply goes (the chat that wrote, possibly an @lid).
create table if not exists s5.platform_inbound (
  message_id text primary key,
  session text not null references s5.session (name),
  chat_id text not null,
  phone text,
  received_at timestamptz not null
);

-- Every platform send, one per inbound at most.
create table if not exists s5.platform_outbound (
  id bigserial primary key,
  session text not null references s5.session (name),
  reply_to text not null references s5.platform_inbound (message_id),
  status text not null check (status in ('sending', 'sent', 'failed', 'unknown', 'refused')),
  reason text,
  wa_message_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create unique index if not exists platform_outbound_once
  on s5.platform_outbound (reply_to) where status <> 'refused';
