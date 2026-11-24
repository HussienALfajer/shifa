-- A-01-11 (expand, OD-98, OD-99): a self re-enrolment's pending TOTP secret and its own replay
-- state (shifa_auth's table grant covers them; shifa_app's column grant does not), and the
-- invitation link's phone follows a pending owner's corrected phone (ON UPDATE CASCADE; RI
-- actions run as the table owner). The FK is re-created and validated under a lock of
-- setup_link and membership (small tables). Rollback: drop the two columns (unused by older
-- code); re-create the FK without ON UPDATE.
ALTER TABLE "two_factor" ADD COLUMN "pending_secret" text;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "pending_last_used_step" bigint;--> statement-breakpoint
ALTER TABLE "setup_link" DROP CONSTRAINT "setup_link_invited_phone_fk", ADD CONSTRAINT "setup_link_invited_phone_fk" FOREIGN KEY ("tenant_id","membership_id","invited_phone") REFERENCES "membership"("tenant_id","id","phone_e164") ON DELETE CASCADE ON UPDATE CASCADE;