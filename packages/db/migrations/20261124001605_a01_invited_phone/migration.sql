-- A-01-05 (expand, OD-90): an invitation link carries its member's phone, so the auth path can
-- find a person's open invitations by phone without reading membership from a setup_link policy
-- (which would recurse). The foreign key makes it the membership's own phone. Rollback: drop the
-- constraints and the column.
ALTER TABLE "setup_link" ADD COLUMN "invited_phone" text;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_tenant_id_id_phone_e164_key" UNIQUE("tenant_id","id","phone_e164");--> statement-breakpoint
ALTER TABLE "setup_link" ADD CONSTRAINT "setup_link_invited_phone_fk" FOREIGN KEY ("tenant_id","membership_id","invited_phone") REFERENCES "membership"("tenant_id","id","phone_e164") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "setup_link" ADD CONSTRAINT "setup_link_invited_phone_check" CHECK ("invited_phone" is null or "purpose" = 'invitation');
