-- A-03-04 (expand): row security and grants of the treating doctors
-- (20261128020206_a03_treating_doctors). Runs as shifa_owner, which is NOBYPASSRLS.
-- * patient_treating_doctor (tenant): a chart's treating doctors by membership id (spec A-03
--   criterion 10). shifa_app reads, adds and removes its own clinic's rows; a list is replaced by
--   deleting and adding rows, never updated. shifa_auth and shifa_platform hold nothing on it.
-- The same migration's companion added `patient_tenant_id_contact_phone_idx` (families and the
-- duplicate check's phone rule) and `patient_relation_value_check` (the ten relations; the column
-- has held no value before this slice).
-- Rollback: drop the policy, disable RLS and revoke the grants; the table, the index and the
-- check go with a contract migration.
ALTER TABLE "patient_treating_doctor" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_treating_doctor" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient_treating_doctor" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "patient_treating_doctor" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_treating_doctor_tenant_isolation ON "patient_treating_doctor"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
