-- A-01-05 (expand): only a bound membership is active. Added NOT VALID, then validated, so the
-- ADD takes no long lock on existing rows. Rollback: DROP CONSTRAINT membership_active_is_bound.
ALTER TABLE "membership" ADD CONSTRAINT "membership_active_is_bound" CHECK ("status" <> 'active' or "user_id" is not null) NOT VALID;
--> statement-breakpoint
ALTER TABLE "membership" VALIDATE CONSTRAINT "membership_active_is_bound";
