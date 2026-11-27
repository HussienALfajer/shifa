-- A-02-04 (expand + migrate): backfill, row security and grants of the settings tables
-- (20261127044024_a02_settings). Runs as shifa_owner, which is NOBYPASSRLS: FORCE RLS applies to it.
-- * Migrate: every clinic's idle sign-out (tenant.idle_minutes, A-01a criterion 9) becomes its
--   organization value of `session.idle_minutes`, so existing 15/30/60 values keep working.
--   `tenant` is FORCE RLS with no policy for the owner, so the owner reads it only through the
--   temporary policy `tenant_owner_backfill`, dropped right after (security review B1); the insert
--   runs before RLS is enabled on setting_value. tenant.idle_minutes stays, unread, until A-02-06's
--   contract migration drops it.
-- * platform_setting_value (global, no clinic data): every role reads it; no role writes it, the
--   owner included (FORCE RLS, a SELECT policy only). A later migration that seeds a value adds a
--   temporary `FOR INSERT TO shifa_owner WITH CHECK (true)` policy, inserts, and drops it in the
--   same migration (the pattern of `tenant_owner_backfill` below).
-- * setting_value (tenant): shifa_app reads its own clinic's values and writes the unlocked ones
--   (never `locked`: a column grant for UPDATE and restrictive policies, owner-approved at
--   /db-migration); shifa_platform reads them inside the clinic's context in setting actions only,
--   writes only organization values with a lock (setting.locked; UPDATE by column: value, locked,
--   set_by, set_at) and removes a lock (setting.unlocked); shifa_auth reads the organization's
--   `session.idle_minutes` of the clinics the signed-in person belongs to, nothing else.
-- Every policy for shifa_platform or shifa_auth has its reason in src/schema/classification.ts.
-- Deploy with no instance of the earlier API serving: it writes tenant.idle_minutes, which the
-- cascade no longer reads.
-- Rollback: drop every policy below, disable RLS on both tables and revoke the grants; the rows
-- can stay. A rollback of the code reads tenant.idle_minutes again, as it was at this migration
-- (changes made through the cascade since are not copied back).
CREATE POLICY tenant_owner_backfill ON "tenant" FOR SELECT TO shifa_owner USING (true);
--> statement-breakpoint
INSERT INTO "setting_value" ("tenant_id", "scope", "scope_id", "key", "value")
  SELECT t.id, 'organization', NULL, 'session.idle_minutes', to_jsonb(t.idle_minutes::integer)
    FROM "tenant" t
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
DROP POLICY tenant_owner_backfill ON "tenant";
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
-- The super admin never changes a value's clinic, scope or key (security review N2).
GRANT SELECT, INSERT, DELETE ON "setting_value" TO shifa_platform;
--> statement-breakpoint
GRANT UPDATE (value, locked, set_by, set_at) ON "setting_value" TO shifa_platform;
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
-- Restrictive: whatever else is set (even a tenant), the auth path reads the idle key of the
-- person's own clinics and nothing else (security review N1).
CREATE POLICY setting_value_auth_only_idle ON "setting_value" AS RESTRICTIVE FOR SELECT
  TO shifa_auth
  USING (key = 'session.idle_minutes' AND scope = 'organization'
         AND EXISTS (SELECT 1 FROM "membership" m
                      WHERE m.tenant_id = "setting_value".tenant_id
                        AND m.user_id = current_user_id()));
