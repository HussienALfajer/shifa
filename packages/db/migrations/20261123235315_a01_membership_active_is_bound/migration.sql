-- A-01-05 (expand): only a bound membership is active. Added NOT VALID, then validated; the
-- migrator runs pending migrations in one transaction, so the ADD's lock lasts through the
-- VALIDATE (the table is small). Rollback: DROP CONSTRAINT membership_active_is_bound.
ALTER TABLE "membership" ADD CONSTRAINT "membership_active_is_bound" CHECK ("status" <> 'active' or "user_id" is not null) NOT VALID;
--> statement-breakpoint
ALTER TABLE "membership" VALIDATE CONSTRAINT "membership_active_is_bound";
