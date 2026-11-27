-- A-03-02 (expand): row security and grants of the chart tables (20261127153450_a03_patients).
-- Runs as shifa_owner, which is NOBYPASSRLS.
-- * patient (tenant, personal data): shifa_app reads, registers and edits its own clinic's charts
--   and never deletes one (spec A-03 criterion 13: charts are never deleted; archived instead).
--   shifa_auth and shifa_platform hold nothing on it.
-- * patient_file_counter (tenant): the clinic's next file number, taken by an upsert inside the
--   registration's transaction (criterion 2); shifa_app reads and writes its own clinic's row and
--   never deletes it (a deleted row would restart the numbers at 1).
-- Rollback: drop both policies, disable RLS on both tables and revoke the grants; the tables go
-- with a contract migration.
ALTER TABLE "patient" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "patient" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_tenant_isolation ON "patient"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
ALTER TABLE "patient_file_counter" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_file_counter" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient_file_counter" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "patient_file_counter" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_file_counter_tenant_isolation ON "patient_file_counter"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
