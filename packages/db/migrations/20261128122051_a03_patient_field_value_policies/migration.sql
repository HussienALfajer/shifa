-- A-03-06 (expand, and one migrate step): row security and grants of the custom field values
-- (20261128122049_a03_patient_field_values). Runs as shifa_owner, which is NOBYPASSRLS.
-- * patient_field_value (tenant): one chart's value of one field and its search key (spec A-03
--   criteria 4, 16, 17); personal data. shifa_app reads, adds, updates and deletes its own
--   clinic's rows: a cleared value is deleted, and so are a purged field's values.
-- shifa_auth and shifa_platform hold nothing on it.
-- * patient_field (migrate): OD-146 point 3 makes choices and yes/no unsearchable (they have no
--   search key); a field of those types saved as searchable under A-03-05 is turned off, so it
--   stops counting against the 5 and its next edit is not refused (review N1). FORCE RLS is lifted
--   for the update only (the owner then sees every clinic's rows) and set again.
-- Rollback: drop the policy, disable RLS and revoke the grants; the table goes with a contract
-- migration. The searchable flags turned off are not turned back on.
ALTER TABLE "patient_field_value" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_field_value" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient_field_value" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "patient_field_value" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_field_value_tenant_isolation ON "patient_field_value"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
ALTER TABLE "patient_field" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE "patient_field" SET "searchable" = false
 WHERE "searchable" AND "type" IN ('single_choice', 'multi_choice', 'yes_no');
--> statement-breakpoint
ALTER TABLE "patient_field" FORCE ROW LEVEL SECURITY;
