-- A-01-11 (expand, OD-99): the super admin corrects the phone of a clinic's pending owner, only in
-- an owner.phone_changed action, and re-issues the owner's link in the same transaction. Runs as
-- shifa_owner. shifa_platform gains UPDATE on two membership columns only (never user_id, status
-- or the name), for the owner membership of a clinic whose owner has no account yet; the two
-- restrictive setup_link policies are replaced by ones with the same name that also allow
-- owner.phone_changed (their other conditions are unchanged). Every policy for shifa_platform has
-- its reason in src/schema/classification.ts. Rollback: drop the two membership policies, revoke
-- the column grant, recreate the setup_link policies as in 20261123205528.
GRANT UPDATE (phone_e164, updated_at) ON "membership" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY membership_platform_phone_change ON "membership" FOR UPDATE TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'owner.phone_changed'
         AND user_id IS NULL AND status = 'pending'
         AND EXISTS (SELECT 1 FROM "role_assignment" ra
                      WHERE ra.tenant_id = "membership".tenant_id
                        AND ra.membership_id = "membership".id AND ra.role = 'owner'))
  WITH CHECK (user_id IS NULL AND status = 'pending'
              AND EXISTS (SELECT 1 FROM "role_assignment" ra
                           WHERE ra.tenant_id = "membership".tenant_id
                             AND ra.membership_id = "membership".id AND ra.role = 'owner'));
--> statement-breakpoint
-- Restrictive: the tenant isolation policy (PUBLIC) would otherwise let shifa_platform, with a
-- tenant set, update any membership row it can see.
CREATE POLICY membership_platform_phone_only ON "membership" AS RESTRICTIVE FOR UPDATE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'owner.phone_changed'
         AND user_id IS NULL AND status = 'pending'
         AND EXISTS (SELECT 1 FROM "role_assignment" ra
                      WHERE ra.tenant_id = "membership".tenant_id
                        AND ra.membership_id = "membership".id AND ra.role = 'owner'))
  WITH CHECK (user_id IS NULL AND status = 'pending'
              AND EXISTS (SELECT 1 FROM "role_assignment" ra
                           WHERE ra.tenant_id = "membership".tenant_id
                             AND ra.membership_id = "membership".id AND ra.role = 'owner'));
--> statement-breakpoint
DROP POLICY setup_link_platform_issue_only ON "setup_link";
--> statement-breakpoint
CREATE POLICY setup_link_platform_issue_only ON "setup_link" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true)
              IN ('clinic.created', 'owner.link_issued', 'owner.phone_changed'));
--> statement-breakpoint
DROP POLICY setup_link_platform_replace_only ON "setup_link";
--> statement-breakpoint
CREATE POLICY setup_link_platform_replace_only ON "setup_link" AS RESTRICTIVE FOR UPDATE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN ('owner.link_issued', 'owner.phone_changed')
         AND used_at IS NULL AND replaced_at IS NULL)
  WITH CHECK (replaced_at IS NOT NULL);
