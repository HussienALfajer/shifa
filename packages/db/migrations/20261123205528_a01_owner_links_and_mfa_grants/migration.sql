-- A-01-03 (ADR-0043): grants and policies for clinic owners, setup links and super admins. Runs
-- as shifa_owner. Expand only: new privileges and policies; `membership_auth_only_own` is
-- replaced by a policy of the same name that also lets the auth path reach a link's membership.
-- Every policy for shifa_auth or shifa_platform has its reason in src/schema/classification.ts.

-- platform_admin (global): read by the auth path (principal), written only by the seed command.
ALTER TABLE "platform_admin" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_admin" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "platform_admin" FROM shifa_app;
--> statement-breakpoint
GRANT SELECT ON "platform_admin" TO shifa_auth;
--> statement-breakpoint
GRANT INSERT ON "platform_admin" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY platform_admin_auth_read ON "platform_admin" FOR SELECT TO shifa_auth USING (true);
--> statement-breakpoint
CREATE POLICY platform_admin_platform_seed ON "platform_admin" FOR INSERT TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'platform.admin_created');
--> statement-breakpoint

-- Clinic creation writes the owner: a pending membership, the owner role and the setup link,
-- under the tenant context createClinic() sets, only in a clinic.created transaction.
GRANT INSERT ON "membership", "role_assignment", "setup_link" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY membership_platform_create_only ON "membership" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'clinic.created');
--> statement-breakpoint
CREATE POLICY role_assignment_platform_create_only ON "role_assignment" AS RESTRICTIVE
  FOR INSERT TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'clinic.created');
--> statement-breakpoint
CREATE POLICY setup_link_platform_issue_only ON "setup_link" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) IN ('clinic.created', 'owner.link_issued'));
--> statement-breakpoint
-- app.admin_reason is a setting the role sets itself: the rows must also be what a clinic's
-- creation writes (security review M1). A membership or owner role only in a clinic that has
-- no owner yet (one owner, written once); a link only for the owner, about 72 h, owner purposes.
CREATE POLICY membership_platform_first_owner_only ON "membership" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (status = 'pending' AND user_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM "role_assignment" ra
                               WHERE ra.tenant_id = "membership".tenant_id AND ra.role = 'owner'));
--> statement-breakpoint
CREATE POLICY role_assignment_platform_first_owner_only ON "role_assignment" AS RESTRICTIVE
  FOR INSERT TO shifa_platform
  WITH CHECK (role = 'owner' AND branch_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM "role_assignment" ra
                               WHERE ra.tenant_id = "role_assignment".tenant_id
                                 AND ra.role = 'owner'));
--> statement-breakpoint
CREATE POLICY setup_link_platform_owner_links_only ON "setup_link" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (purpose IN ('owner_setup', 'invitation')
              -- 72 h by the API's clock; one hour of slack for its skew against now(), which is
              -- the transaction's start.
              AND expires_at <= now() + interval '73 hours'
              AND EXISTS (SELECT 1 FROM "role_assignment" ra
                           WHERE ra.tenant_id = "setup_link".tenant_id
                             AND ra.membership_id = "setup_link".membership_id
                             AND ra.role = 'owner'));
--> statement-breakpoint
-- An owner link resets the password of a set-up account (one account across clinics): only the
-- platform issues one; the clinic path never writes or turns a link into one (review M2).
CREATE POLICY setup_link_app_no_owner_links ON "setup_link" AS RESTRICTIVE FOR INSERT
  TO shifa_app WITH CHECK (purpose <> 'owner_setup');
--> statement-breakpoint
CREATE POLICY setup_link_app_no_owner_links_update ON "setup_link" AS RESTRICTIVE FOR UPDATE
  TO shifa_app USING (purpose <> 'owner_setup') WITH CHECK (purpose <> 'owner_setup');
--> statement-breakpoint

-- The owner card (clinic list and detail, owner support): owner role rows and owner memberships
-- only, a few columns, never another member and never a token hash.
GRANT SELECT (id, tenant_id, membership_id, role) ON "role_assignment" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY role_assignment_platform_owner_read ON "role_assignment" FOR SELECT
  TO shifa_platform USING (role = 'owner');
--> statement-breakpoint
CREATE POLICY role_assignment_platform_only_owner ON "role_assignment" AS RESTRICTIVE
  FOR SELECT TO shifa_platform USING (role = 'owner');
--> statement-breakpoint
GRANT SELECT (id, tenant_id, user_id, phone_e164, display_name, status) ON "membership"
  TO shifa_platform;
--> statement-breakpoint
CREATE POLICY membership_platform_owner_read ON "membership" FOR SELECT TO shifa_platform
  USING (EXISTS (SELECT 1 FROM "role_assignment" ra
                  WHERE ra.tenant_id = "membership".tenant_id
                    AND ra.membership_id = "membership".id AND ra.role = 'owner'));
--> statement-breakpoint
CREATE POLICY membership_platform_only_owner ON "membership" AS RESTRICTIVE FOR SELECT
  TO shifa_platform
  USING (EXISTS (SELECT 1 FROM "role_assignment" ra
                  WHERE ra.tenant_id = "membership".tenant_id
                    AND ra.membership_id = "membership".id AND ra.role = 'owner'));
--> statement-breakpoint

-- Re-issuing an owner's link (owner.link_issued): the earlier unused links are marked replaced,
-- under the tenant context issueOwnerLink() sets. No token hash is ever readable.
GRANT SELECT (id, tenant_id, membership_id, purpose, expires_at, used_at, replaced_at, created_at),
      UPDATE (replaced_at) ON "setup_link" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY setup_link_platform_owner_only ON "setup_link" AS RESTRICTIVE FOR SELECT
  TO shifa_platform
  USING (EXISTS (SELECT 1 FROM "role_assignment" ra
                  WHERE ra.tenant_id = "setup_link".tenant_id
                    AND ra.membership_id = "setup_link".membership_id AND ra.role = 'owner'));
--> statement-breakpoint
CREATE POLICY setup_link_platform_replace_only ON "setup_link" AS RESTRICTIVE FOR UPDATE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'owner.link_issued'
         AND used_at IS NULL AND replaced_at IS NULL)
  WITH CHECK (replaced_at IS NOT NULL);
--> statement-breakpoint

-- The auth path through one link (app.link_token_hash): the person and clinic the setup page
-- shows, and binding the link's membership to the account once the link is used.
CREATE POLICY tenant_auth_link_read ON "tenant" FOR SELECT TO shifa_auth
  USING (EXISTS (SELECT 1 FROM "setup_link" sl
                  WHERE sl.tenant_id = "tenant".id AND sl.token_hash = current_link_token_hash()));
--> statement-breakpoint
CREATE POLICY membership_auth_link_read ON "membership" FOR SELECT TO shifa_auth
  USING (EXISTS (SELECT 1 FROM "setup_link" sl
                  WHERE sl.tenant_id = "membership".tenant_id
                    AND sl.membership_id = "membership".id
                    AND sl.token_hash = current_link_token_hash()));
--> statement-breakpoint
GRANT UPDATE (user_id, status, updated_at) ON "membership" TO shifa_auth;
--> statement-breakpoint
-- Only a pending, unbound membership whose setup link was just used; it becomes active and bound.
CREATE POLICY membership_auth_link_accept ON "membership" FOR UPDATE TO shifa_auth
  USING (user_id IS NULL AND status = 'pending'
         AND EXISTS (SELECT 1 FROM "setup_link" sl
                      WHERE sl.tenant_id = "membership".tenant_id
                        AND sl.membership_id = "membership".id
                        AND sl.token_hash = current_link_token_hash()
                        AND sl.used_at IS NOT NULL
                        AND sl.purpose IN ('owner_setup', 'member_setup')))
  WITH CHECK (user_id IS NOT NULL AND status = 'active');
--> statement-breakpoint
-- Restrictive: even with a tenant set (whose isolation policy is for PUBLIC), shifa_auth updates
-- nothing but that binding (security review L2).
CREATE POLICY membership_auth_accept_only ON "membership" AS RESTRICTIVE FOR UPDATE TO shifa_auth
  USING (user_id IS NULL AND status = 'pending'
         AND EXISTS (SELECT 1 FROM "setup_link" sl
                      WHERE sl.tenant_id = "membership".tenant_id
                        AND sl.membership_id = "membership".id
                        AND sl.token_hash = current_link_token_hash()
                        AND sl.used_at IS NOT NULL
                        AND sl.purpose IN ('owner_setup', 'member_setup')))
  WITH CHECK (user_id IS NOT NULL AND status = 'active');
--> statement-breakpoint
DROP POLICY membership_auth_only_own ON "membership";
--> statement-breakpoint
CREATE POLICY membership_auth_only_own ON "membership" AS RESTRICTIVE TO shifa_auth
  USING (user_id = current_user_id()
         OR EXISTS (SELECT 1 FROM "setup_link" sl
                     WHERE sl.tenant_id = "membership".tenant_id
                       AND sl.membership_id = "membership".id
                       AND sl.token_hash = current_link_token_hash()))
  WITH CHECK (user_id = current_user_id()
         OR EXISTS (SELECT 1 FROM "setup_link" sl
                     WHERE sl.tenant_id = "membership".tenant_id
                       AND sl.membership_id = "membership".id
                       AND sl.token_hash = current_link_token_hash()));
