-- A-01-04 (ADR-0043): team members, invitations and the clinic's idle setting. Runs as
-- shifa_owner. Expand only, plus one narrowing of shifa_app (membership.user_id). Every policy
-- for shifa_auth alone has its reason in src/schema/classification.ts.

-- shifa_app no longer binds a membership to an account: binding happens only on the auth path
-- through a used link (A-01-01 review L4, A-01-03 security review M2). The other columns the
-- team module changes stay updatable.
REVOKE UPDATE ON "membership" FROM shifa_app;
--> statement-breakpoint
GRANT UPDATE (display_name, status, last_active_at, updated_at) ON "membership" TO shifa_app;
--> statement-breakpoint

-- An invitation (a phone that already has an account) is accepted by that person signed in
-- (withUserLink): the link must be used, the membership pending and unbound, and it is bound
-- to the signed-in person only, whose phone must be the one the owner invited. Setup links
-- bind as before (A-01-03).
DROP POLICY membership_auth_link_accept ON "membership";
--> statement-breakpoint
CREATE POLICY membership_auth_link_accept ON "membership" FOR UPDATE TO shifa_auth
  USING (user_id IS NULL AND status = 'pending'
         AND EXISTS (SELECT 1 FROM "setup_link" sl
                      WHERE sl.tenant_id = "membership".tenant_id
                        AND sl.membership_id = "membership".id
                        AND sl.token_hash = current_link_token_hash()
                        AND sl.used_at IS NOT NULL
                        AND sl.purpose IN ('owner_setup', 'member_setup', 'invitation')))
  WITH CHECK (user_id IS NOT NULL AND status = 'active');
--> statement-breakpoint
DROP POLICY membership_auth_accept_only ON "membership";
--> statement-breakpoint
CREATE POLICY membership_auth_accept_only ON "membership" AS RESTRICTIVE FOR UPDATE TO shifa_auth
  USING (user_id IS NULL AND status = 'pending'
         AND EXISTS (SELECT 1 FROM "setup_link" sl
                      WHERE sl.tenant_id = "membership".tenant_id
                        AND sl.membership_id = "membership".id
                        AND sl.token_hash = current_link_token_hash()
                        AND sl.used_at IS NOT NULL
                        AND sl.purpose IN ('owner_setup', 'member_setup', 'invitation')))
  WITH CHECK (user_id IS NOT NULL AND status = 'active'
              -- Every link binds only the account of the phone the membership names
              -- (security review L2), and never a super admin's (OD-89).
              AND phone_e164 = (SELECT u.phone_number FROM "user" u
                                 WHERE u.id = "membership".user_id)
              AND NOT EXISTS (SELECT 1 FROM "platform_admin" pa
                               WHERE pa.user_id = "membership".user_id)
              AND (NOT EXISTS (SELECT 1 FROM "setup_link" sl
                                WHERE sl.tenant_id = "membership".tenant_id
                                  AND sl.membership_id = "membership".id
                                  AND sl.token_hash = current_link_token_hash()
                                  AND sl.purpose = 'invitation')
                   OR user_id = current_user_id()));
--> statement-breakpoint

-- Links written by a clinic (security review L2): only fresh member links and invitations of
-- about 72 h, and afterwards only marked replaced. A used link never becomes usable again, and
-- no clinic can make a long-lived reset credential.
REVOKE UPDATE ON "setup_link" FROM shifa_app;
--> statement-breakpoint
GRANT UPDATE (replaced_at) ON "setup_link" TO shifa_app;
--> statement-breakpoint
CREATE POLICY setup_link_app_fresh_only ON "setup_link" AS RESTRICTIVE FOR INSERT TO shifa_app
  WITH CHECK (used_at IS NULL AND replaced_at IS NULL
              AND purpose IN ('member_setup', 'invitation')
              -- 72 h by the API's clock; one hour of slack for its skew against now().
              AND expires_at <= now() + interval '73 hours');
--> statement-breakpoint
CREATE POLICY setup_link_app_replace_only ON "setup_link" AS RESTRICTIVE FOR UPDATE TO shifa_app
  USING (used_at IS NULL AND replaced_at IS NULL) WITH CHECK (replaced_at IS NOT NULL);
--> statement-breakpoint

-- The owner's idle setting (A-01a criterion 9, owner-approved column grant): a clinic changes
-- its own idle minutes and nothing else on `tenant`.
GRANT UPDATE (idle_minutes, updated_at) ON "tenant" TO shifa_app;
--> statement-breakpoint
CREATE POLICY tenant_app_settings ON "tenant" FOR UPDATE TO shifa_app
  USING (id = current_tenant_id()) WITH CHECK (id = current_tenant_id());
--> statement-breakpoint

-- The auth path reads a person's own role assignments across clinics: the MFA gate applies to an
-- owner before a clinic is chosen (A-01-03 review 2), and the clinic chooser shows the role
-- (A-01b 10). Never a secret column; nobody else's roles.
GRANT SELECT (id, tenant_id, membership_id, role, branch_id) ON "role_assignment" TO shifa_auth;
--> statement-breakpoint
CREATE POLICY role_assignment_auth_own_read ON "role_assignment" FOR SELECT TO shifa_auth
  USING (EXISTS (SELECT 1 FROM "membership" m
                  WHERE m.tenant_id = "role_assignment".tenant_id
                    AND m.id = "role_assignment".membership_id
                    AND m.user_id = current_user_id()));
--> statement-breakpoint
CREATE POLICY role_assignment_auth_only_own ON "role_assignment" AS RESTRICTIVE FOR SELECT
  TO shifa_auth
  USING (EXISTS (SELECT 1 FROM "membership" m
                  WHERE m.tenant_id = "role_assignment".tenant_id
                    AND m.id = "role_assignment".membership_id
                    AND m.user_id = current_user_id()));
