-- Spike-only PowerSync role (criterion 10 notes it bypasses RLS: the sync streams are the only
-- tenant boundary on the download side). Run as superuser in the spike container only.
CREATE ROLE s1_powersync LOGIN REPLICATION BYPASSRLS PASSWORD :password;
-- @owner
-- Run as shifa_owner in the `shifa` database: the tables PowerSync replicates.
-- PostgreSQL 18 leaves generated columns (appointment.starts_at/ends_at) out unless asked.
CREATE PUBLICATION powersync FOR TABLE
  s1.appointment, s1.queue_ticket, s1.cash_session, s1.cash_movement, s1.offline_command
  WITH (publish_generated_columns = stored);
