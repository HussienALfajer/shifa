-- A-01-05 (expand, OD-90, OD-91): the clinic chooser lists the signed-in person's pending
-- invitations (clinic name and roles only). Runs as shifa_owner. On the auth path (withUser)
-- shifa_auth reads a pending, unbound membership for the account's phone that has an open
-- invitation link carrying that phone, and those links; it binds and uses nothing by phone:
-- accepting and declining stay on the invitation's link (OD-91: phones are unverified until
-- A-09). setup_link policies never read membership (no recursion): the link's own
-- invited_phone decides. Two restrictive policies are replaced by ones with the same name that
-- add this read path; their link paths and WITH CHECK are unchanged. Every policy for shifa_auth
-- has its reason in src/schema/classification.ts. Rollback: drop the new policies and function
-- and recreate the two restrictive policies as in 20261123183321 and 20261123205528.

-- The signed-in person's phone (app.user_id), NULL when unset. Read on the auth path only.
CREATE FUNCTION public.current_user_phone() RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT u.phone_number FROM "user" u WHERE u.id = current_user_id() $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_user_phone() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_user_phone() TO shifa_auth;
--> statement-breakpoint

-- setup_link: invitation links for the account's phone are readable, nothing more.
CREATE POLICY setup_link_auth_invited_read ON "setup_link" FOR SELECT TO shifa_auth
  USING (purpose = 'invitation' AND invited_phone = current_user_phone());
--> statement-breakpoint
DROP POLICY setup_link_auth_only_link ON "setup_link";
--> statement-breakpoint
CREATE POLICY setup_link_auth_only_link ON "setup_link" AS RESTRICTIVE TO shifa_auth
  USING (token_hash = current_link_token_hash()
         OR (purpose = 'invitation' AND invited_phone = current_user_phone()))
  WITH CHECK (token_hash = current_link_token_hash());
--> statement-breakpoint

-- membership: an open invitation for the account's phone, read only.
CREATE POLICY membership_auth_invited_read ON "membership" FOR SELECT TO shifa_auth
  USING (user_id IS NULL AND status = 'pending' AND phone_e164 = current_user_phone()
         AND EXISTS (SELECT 1 FROM "setup_link" sl
                      WHERE sl.tenant_id = "membership".tenant_id
                        AND sl.membership_id = "membership".id
                        AND sl.purpose = 'invitation'
                        AND sl.invited_phone = current_user_phone()
                        AND sl.used_at IS NULL AND sl.replaced_at IS NULL
                        AND sl.expires_at > now()));
--> statement-breakpoint
DROP POLICY membership_auth_only_own ON "membership";
--> statement-breakpoint
CREATE POLICY membership_auth_only_own ON "membership" AS RESTRICTIVE TO shifa_auth
  USING (user_id = current_user_id()
         OR EXISTS (SELECT 1 FROM "setup_link" sl
                     WHERE sl.tenant_id = "membership".tenant_id
                       AND sl.membership_id = "membership".id
                       AND sl.token_hash = current_link_token_hash())
         OR (user_id IS NULL AND status = 'pending' AND phone_e164 = current_user_phone()
             AND EXISTS (SELECT 1 FROM "setup_link" sl
                          WHERE sl.tenant_id = "membership".tenant_id
                            AND sl.membership_id = "membership".id
                            AND sl.purpose = 'invitation'
                            AND sl.invited_phone = current_user_phone()
                            AND sl.used_at IS NULL AND sl.replaced_at IS NULL
                            AND sl.expires_at > now())))
  WITH CHECK (user_id = current_user_id()
         OR EXISTS (SELECT 1 FROM "setup_link" sl
                     WHERE sl.tenant_id = "membership".tenant_id
                       AND sl.membership_id = "membership".id
                       AND sl.token_hash = current_link_token_hash()));
