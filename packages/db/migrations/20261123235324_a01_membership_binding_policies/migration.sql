-- A-01-05 (expand; backlog "Membership binding on INSERT", A-01-01 security review L4, A-01-04
-- security review L2). Runs as shifa_owner. No clinic appears in a person's chooser unless that
-- person accepted it: no role writes a membership already bound to an account by INSERT. The
-- team adds pending rows, createClinic() adds the pending owner (shifa_platform), and shifa_auth
-- binds by UPDATE through a used link only, so PUBLIC breaks nothing and also closes "delete a
-- pending one and re-insert it bound". Rollback: drop both policies.
CREATE POLICY membership_insert_unbound ON "membership" AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (user_id IS NULL AND status = 'pending');
--> statement-breakpoint
-- shifa_app holds UPDATE (status): a bound member never goes back to pending, which the accept
-- policies match (the CHECK membership_active_is_bound keeps an unbound one from being active).
CREATE POLICY membership_app_never_unbind ON "membership" AS RESTRICTIVE FOR UPDATE TO shifa_app
  USING (true)
  WITH CHECK (status <> 'pending' OR user_id IS NULL);
