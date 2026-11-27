-- A-02-04 (expand + migrate): backfill, row security and grants of the settings tables
-- (20261127044024_a02_settings). Runs as shifa_owner.
-- * Migrate: every clinic's idle sign-out (tenant.idle_minutes, A-01a criterion 9) becomes its
--   organization value of `session.idle_minutes`, so existing 15/30/60 values keep working. Written
--   before RLS is enabled (FORCE RLS applies to the owner too). tenant.idle_minutes stays, unread,
--   until A-02-06's contract migration drops it.
-- * platform_setting_value (global, no clinic data): every role reads it; nobody but the owner
--   (migrations) writes it.
-- * setting_value (tenant): shifa_app reads its own clinic's values and writes the unlocked ones
--   (never `locked`: a column grant for UPDATE and restrictive policies, owner-approved at
--   /db-migration); shifa_platform reads them inside the clinic's context in setting actions only,
--   and writes only organization values with a lock (setting.locked) or removes a lock
--   (setting.unlocked); shifa_auth reads the organization's `session.idle_minutes` of the clinics
--   the signed-in person belongs to (each session's idle limit, criterion 10), nothing else.
-- Every policy for shifa_platform or shifa_auth has its reason in src/schema/classification.ts.
-- Rollback: drop every policy below, disable RLS on both tables and revoke the grants; the rows
-- can stay (tenant.idle_minutes still holds each clinic's value as of this migration). The tables
-- go with a contract migration.
INSERT INTO "setting_value" ("tenant_id", "scope", "scope_id", "key", "value")
  SELECT t.id, 'organization', NULL, 'session.idle_minutes', to_jsonb(t.idle_minutes::integer)
    FROM "tenant" t
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "platform_setting_value" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_setting_value" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "platform_setting_value" FROM shifa_app;
--> statement-breakpoint
GRANT SELECT ON "platform_setting_value" TO shifa_platform, shifa_auth;
--> statement-breakpoint
CREATE POLICY platform_setting_value_read ON "platform_setting_value" FOR SELECT USING (true);
--> statement-breakpoint
ALTER TABLE "setting_value" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "setting_value" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON "setting_value" FROM shifa_app;
--> statement-breakpoint
-- The clinic changes a value and who set it, never its scope, key or lock.
GRANT UPDATE (value, set_by, set_at) ON "setting_value" TO shifa_app;
--> statement-breakpoint
CREATE POLICY setting_value_tenant_isolation ON "setting_value"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
-- Restrictive: shifa_app never writes a locked value, and never writes one locked.
CREATE POLICY setting_value_app_unlocked_insert ON "setting_value" AS RESTRICTIVE FOR INSERT
  TO shifa_app
  WITH CHECK (NOT locked);
--> statement-breakpoint
CREATE POLICY setting_value_app_unlocked_update ON "setting_value" AS RESTRICTIVE FOR UPDATE
  TO shifa_app
  USING (NOT locked) WITH CHECK (NOT locked);
--> statement-breakpoint
CREATE POLICY setting_value_app_unlocked_delete ON "setting_value" AS RESTRICTIVE FOR DELETE
  TO shifa_app
  USING (NOT locked);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "setting_value" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY setting_value_platform_read_only_in_actions ON "setting_value" AS RESTRICTIVE
  FOR SELECT TO shifa_platform
  USING (current_setting('app.admin_reason', true)
         IN ('setting.viewed', 'setting.locked', 'setting.unlocked'));
--> statement-breakpoint
CREATE POLICY setting_value_platform_lock_only ON "setting_value" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'setting.locked'
              AND locked AND scope = 'organization');
--> statement-breakpoint
CREATE POLICY setting_value_platform_relock_only ON "setting_value" AS RESTRICTIVE FOR UPDATE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'setting.locked'
         AND scope = 'organization')
  WITH CHECK (current_setting('app.admin_reason', true) = 'setting.locked'
              AND locked AND scope = 'organization');
--> statement-breakpoint
CREATE POLICY setting_value_platform_unlock_only ON "setting_value" AS RESTRICTIVE FOR DELETE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'setting.unlocked'
         AND locked AND scope = 'organization');
--> statement-breakpoint
GRANT SELECT (tenant_id, scope, scope_id, key, value, locked) ON "setting_value" TO shifa_auth;
--> statement-breakpoint
CREATE POLICY setting_value_auth_idle_read ON "setting_value" FOR SELECT TO shifa_auth
  USING (key = 'session.idle_minutes' AND scope = 'organization'
         AND EXISTS (SELECT 1 FROM "membership" m
                      WHERE m.tenant_id = "setting_value".tenant_id
                        AND m.user_id = current_user_id()));
--> statement-breakpoint
-- Restrictive: whatever else is set, the auth path reads the idle key and nothing else.
CREATE POLICY setting_value_auth_only_idle ON "setting_value" AS RESTRICTIVE FOR SELECT
  TO shifa_auth
  USING (key = 'session.idle_minutes' AND scope = 'organization');
