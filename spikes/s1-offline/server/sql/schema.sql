-- Spike 0.3-S1 tables, in their own schema `s1` (never in packages/db/migrations). Applied as
-- shifa_owner, idempotent. Same tenancy rules as `public`: tenant_id on every row, ENABLE +
-- FORCE RLS, policies on public.current_tenant_id(), reached only through withTenant().
CREATE SCHEMA IF NOT EXISTS s1;
REVOKE ALL ON SCHEMA s1 FROM PUBLIC;
GRANT USAGE ON SCHEMA s1 TO shifa_app;

-- Reference rows the handler checks ids against: an id of another tenant is invisible.
CREATE TABLE IF NOT EXISTS s1.practitioner (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  branch_id uuid NOT NULL,
  label text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS s1.appointment (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  branch_id uuid NOT NULL,
  practitioner_id uuid NOT NULL,
  patient_id uuid,
  slot tstzrange NOT NULL,
  -- The clinic's date of the slot start (Asia/Damascus): PowerSync streams filter "today" on it.
  clinic_day date NOT NULL,
  -- Plain columns for clients that cannot read a range (PowerSync replicates it as text).
  starts_at timestamptz GENERATED ALWAYS AS (lower(slot)) STORED,
  ends_at timestamptz GENERATED ALWAYS AS (upper(slot)) STORED,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_id) REFERENCES s1.practitioner (tenant_id, id),
  -- SCH-14: one practitioner, no overlapping live slots.
  CONSTRAINT appointment_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, practitioner_id WITH =, slot WITH &&
  ) WHERE (status <> 'cancelled')
);
CREATE INDEX IF NOT EXISTS appointment_sync ON s1.appointment (tenant_id, branch_id, updated_at);

CREATE TABLE IF NOT EXISTS s1.queue_ticket (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  branch_id uuid NOT NULL,
  practitioner_id uuid NOT NULL,
  patient_id uuid,
  shift_date date NOT NULL,
  provisional_number integer NOT NULL CHECK (provisional_number > 0),
  device_id text NOT NULL,
  real_number integer NOT NULL CHECK (real_number > 0),
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'called', 'in_service', 'done', 'no_show')),
  walk_in_label text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_id) REFERENCES s1.practitioner (tenant_id, id),
  -- SCH-16: one real number per practitioner and shift.
  UNIQUE (tenant_id, branch_id, practitioner_id, shift_date, real_number)
);
CREATE INDEX IF NOT EXISTS queue_ticket_sync ON s1.queue_ticket (tenant_id, branch_id, updated_at);

CREATE TABLE IF NOT EXISTS s1.cash_session (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  branch_id uuid NOT NULL,
  -- Exchange rates captured when the session opened online: {"SYP": "11000", "TRY": "41.5"}
  -- units of the currency per 1 USD, as decimal strings (never floats).
  rates jsonb NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  clinic_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Damascus')::date,
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS cash_session_sync ON s1.cash_session (tenant_id, branch_id, updated_at);

-- Append-only (BIL-25): shifa_app may insert and read, never update or delete.
CREATE TABLE IF NOT EXISTS s1.cash_movement (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  branch_id uuid NOT NULL,
  session_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('sale', 'refund', 'expense', 'deposit', 'float_adjust')),
  currency text NOT NULL CHECK (currency IN ('SYP', 'TRY', 'USD')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  rate_used numeric NOT NULL CHECK (rate_used > 0),
  offline boolean NOT NULL,
  refund_of uuid,
  device_id text NOT NULL,
  clinic_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Damascus')::date,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, session_id) REFERENCES s1.cash_session (tenant_id, id),
  FOREIGN KEY (tenant_id, refund_of) REFERENCES s1.cash_movement (tenant_id, id),
  CHECK ((type = 'refund') = (refund_of IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS cash_movement_sync ON s1.cash_movement (tenant_id, branch_id, updated_at);
CREATE INDEX IF NOT EXISTS cash_movement_refund ON s1.cash_movement (tenant_id, refund_of);

-- Idempotency store (SCH-13) and, for PowerSync, the result rows a device downloads.
CREATE TABLE IF NOT EXISTS s1.offline_command (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  branch_id uuid NOT NULL,
  device_id text NOT NULL,
  type text NOT NULL,
  result jsonb NOT NULL,
  client_time timestamptz,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS offline_command_device ON s1.offline_command (tenant_id, device_id, received_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['practitioner', 'appointment', 'queue_ticket', 'cash_session',
                           'cash_movement', 'offline_command'] LOOP
    EXECUTE format('ALTER TABLE s1.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE s1.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON s1.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON s1.%I TO shifa_app
                      USING (tenant_id = public.current_tenant_id())
                      WITH CHECK (tenant_id = public.current_tenant_id())', t);
    EXECUTE format('REVOKE ALL ON s1.%I FROM PUBLIC, shifa_app', t);
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE ON s1.practitioner, s1.appointment, s1.queue_ticket, s1.cash_session
  TO shifa_app;
GRANT SELECT, INSERT ON s1.cash_movement, s1.offline_command TO shifa_app;
