-- A-01-12 (expand, OD-103): the owner corrects a pending member's phone through shifa_app. Runs
-- as shifa_owner. shifa_app gains UPDATE on membership.phone_e164 (the tenant policy keeps it to
-- the clinic's rows). An RLS policy cannot compare the old and new row, so a trigger guards the
-- column for every role (the table owner and shifa_platform included): a changed phone is
-- refused unless the row was unbound (user_id IS NULL) and pending. The name edit of an active
-- member and an UPDATE that leaves the phone as it was pass. An invitation link naming the old
-- phone follows it (setup_link_invited_phone_fk, ON UPDATE CASCADE since 20261124162309).
-- Rollback: DROP TRIGGER membership_phone_unbound_only ON membership; DROP FUNCTION
-- public.membership_phone_unbound_only(); REVOKE UPDATE (phone_e164) ON membership FROM shifa_app.
GRANT UPDATE (phone_e164) ON "membership" TO shifa_app;
--> statement-breakpoint
CREATE FUNCTION public.membership_phone_unbound_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF OLD.user_id IS NOT NULL OR OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'membership phone changes only while pending and unbound' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.membership_phone_unbound_only() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER membership_phone_unbound_only BEFORE UPDATE OF phone_e164 ON "membership"
  FOR EACH ROW WHEN (OLD.phone_e164 IS DISTINCT FROM NEW.phone_e164)
  EXECUTE FUNCTION public.membership_phone_unbound_only();
