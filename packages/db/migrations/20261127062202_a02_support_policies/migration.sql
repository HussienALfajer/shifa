-- A-02-05 (expand): row security and grants of support_access_grant (20261127062201_a02_support_access;
-- ADR-0050). Runs as shifa_owner; no data is read or written, so no temporary owner policy is needed.
-- * shifa_app reads its own clinic's grants (the hand-off hash too, as it reads setup links' hashes:
--   a SHA-256 of a single-use 2-minute token reveals nothing; the API never selects it), and an owner
--   ends an open one: UPDATE of ended_at, ended_by, ended_by_name, end_reason only, by a restrictive
--   policy to `owner` by the person acting (owner-approved column grant, criterion 13).
-- * shifa_platform, inside the clinic's context (inTenantContext), only in support actions:
--   support.opened inserts an open grant; support.opened and support.handoff_issued set a hand-off;
--   support.ended ends the admin's own grant; any support action closes an expired grant (`expiry`).
-- * shifa_auth, with no tenant: reads the grant whose hand-off hash is set (withHandoff) or the
--   signed-in super admin's grants (withUser), consumes the hash of an open grant, and closes an
--   expired grant of the signed-in super admin.
-- Every policy for shifa_platform or shifa_auth has its reason in src/schema/classification.ts.
-- Rollback: drop every policy below, disable RLS on support_access_grant and revoke the grants, then
-- drop the table and session.support_grant_id (no other table depends on them).
ALTER TABLE "support_access_grant" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "support_access_grant" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY support_access_grant_tenant_isolation ON "support_access_grant"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "support_access_grant" FROM shifa_app;
--> statement-breakpoint
GRANT UPDATE (ended_at, ended_by, ended_by_name, end_reason) ON "support_access_grant" TO shifa_app;
--> statement-breakpoint
-- Restrictive: the clinic only ends an open, unexpired grant, as an owner, by the person acting.
CREATE POLICY support_access_grant_app_owner_end ON "support_access_grant" AS RESTRICTIVE
  FOR UPDATE TO shifa_app
  USING (ended_at IS NULL AND expires_at > now())
  WITH CHECK (end_reason = 'owner' AND ended_by = current_user_id() AND ended_at IS NOT NULL);
--> statement-breakpoint
GRANT SELECT (id, tenant_id, admin_user_id, admin_name, reason, opened_at, expires_at, ended_at,
              ended_by, ended_by_name, end_reason, handoff_expires_at)
  ON "support_access_grant" TO shifa_platform;
--> statement-breakpoint
GRANT INSERT ON "support_access_grant" TO shifa_platform;
--> statement-breakpoint
GRANT UPDATE (ended_at, ended_by, ended_by_name, end_reason, handoff_token_hash, handoff_expires_at)
  ON "support_access_grant" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY support_access_grant_platform_only_in_support ON "support_access_grant" AS RESTRICTIVE
  FOR SELECT TO shifa_platform
  USING (current_setting('app.admin_reason', true)
         IN ('support.listed', 'support.opened', 'support.handoff_issued', 'support.ended'));
--> statement-breakpoint
CREATE POLICY support_access_grant_platform_open_only ON "support_access_grant" AS RESTRICTIVE
  FOR INSERT TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'support.opened'
              AND ended_at IS NULL AND ended_by IS NULL AND end_reason IS NULL);
--> statement-breakpoint
CREATE POLICY support_access_grant_platform_change_only ON "support_access_grant" AS RESTRICTIVE
  FOR UPDATE TO shifa_platform
  USING (ended_at IS NULL
         AND current_setting('app.admin_reason', true)
             IN ('support.listed', 'support.opened', 'support.handoff_issued', 'support.ended'))
  WITH CHECK (
    (ended_at IS NULL AND expires_at > now()
     AND current_setting('app.admin_reason', true) IN ('support.opened', 'support.handoff_issued'))
    OR (end_reason = 'expiry' AND ended_at = expires_at AND expires_at <= now()
        AND handoff_token_hash IS NULL)
    OR (end_reason = 'admin' AND ended_by = admin_user_id AND handoff_token_hash IS NULL
        AND current_setting('app.admin_reason', true) = 'support.ended'));
--> statement-breakpoint
GRANT SELECT ON "support_access_grant" TO shifa_auth;
--> statement-breakpoint
GRANT UPDATE (ended_at, end_reason, handoff_token_hash, handoff_expires_at)
  ON "support_access_grant" TO shifa_auth;
--> statement-breakpoint
CREATE POLICY support_access_grant_auth_handoff_read ON "support_access_grant" FOR SELECT
  TO shifa_auth
  USING (handoff_token_hash = current_link_token_hash());
--> statement-breakpoint
CREATE POLICY support_access_grant_auth_own_read ON "support_access_grant" FOR SELECT
  TO shifa_auth
  USING (admin_user_id = current_user_id());
--> statement-breakpoint
CREATE POLICY support_access_grant_auth_handoff_use ON "support_access_grant" FOR UPDATE
  TO shifa_auth
  USING (handoff_token_hash = current_link_token_hash() AND handoff_expires_at > now()
         AND ended_at IS NULL AND expires_at > now())
  WITH CHECK (handoff_token_hash IS NULL AND handoff_expires_at IS NULL AND ended_at IS NULL);
--> statement-breakpoint
CREATE POLICY support_access_grant_auth_expire ON "support_access_grant" FOR UPDATE
  TO shifa_auth
  USING (admin_user_id = current_user_id() AND ended_at IS NULL AND expires_at <= now())
  WITH CHECK (end_reason = 'expiry' AND ended_at = expires_at);
--> statement-breakpoint
-- Restrictive: whatever else is set (even a tenant), the auth path reaches only the grant of its
-- hand-off hash or the signed-in super admin's own, and changes them only as above.
CREATE POLICY support_access_grant_auth_only_own ON "support_access_grant" AS RESTRICTIVE
  FOR SELECT TO shifa_auth
  USING (handoff_token_hash = current_link_token_hash() OR admin_user_id = current_user_id());
--> statement-breakpoint
CREATE POLICY support_access_grant_auth_only_use_or_expire ON "support_access_grant" AS RESTRICTIVE
  FOR UPDATE TO shifa_auth
  USING (handoff_token_hash = current_link_token_hash() OR admin_user_id = current_user_id())
  WITH CHECK ((handoff_token_hash IS NULL AND handoff_expires_at IS NULL AND ended_at IS NULL)
              OR (end_reason = 'expiry' AND ended_at = expires_at AND expires_at <= now()));
