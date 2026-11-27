-- A-02-07 (expand): row security, grants and the counts of the announcement and usage tables
-- (20261127101855_a02_announcements_usage). Runs as shifa_owner, which is NOBYPASSRLS.
-- * announcement (global, no clinic data): shifa_platform reads it in announcement actions, inserts
--   only in announcement.created (as its own author, not ended, stamped now) and updates by column
--   only in announcement.edited or announcement.ended (an end names the acting super admin; the
--   trigger announcement_change_guard() keeps each action to its columns); no role deletes one.
--   shifa_app reads seven columns (never who wrote or ended it) of the announcements aimed at its
--   clinic (every clinic, or a target row of its own), never a cancelled one. Which of them are
--   active is decided by the API's clock (start, end), as every other time rule of the API is.
-- * announcement_target (tenant): read-only for shifa_app (its own rows); shifa_platform reads every
--   clinic's in announcement actions (tenant ids only), inserts them in created and edited and
--   deletes them in edited only.
-- * announcement_dismissal (global: a person's own, across clinics): shifa_app inserts and updates
--   only the signed-in person's row (app.user_id), for an announcement its clinic can see and a
--   version not above the current; every role reads only app.user_id's rows (the count function
--   sets it per member); no role deletes one.
-- * usage_daily (tenant): shifa_app reads and writes its own clinic's counters (full DML, as the
--   tenant class requires; the API never deletes one); shifa_platform reads every clinic's in clinic.listed and clinic.usage_viewed only.
-- * membership.last_sign_in_on: shifa_app may UPDATE it (the day of the member's last sign-in).
-- * announcement_counts(uuid[], integer[], boolean[], uuid[]) and clinic_member_counts(uuid)
--   (SECURITY DEFINER, ADR-0051): integers only, for shifa_platform alone, inside their actions;
--   each clinic is read under its own tenant policies and every setting it moves is restored.
-- Every policy for shifa_platform has its reason in src/schema/classification.ts; the functions are
-- listed there (COUNT_FUNCTIONS) and pinned in test/privileges.test.ts.
-- Rollback: drop both functions, the trigger and its function and every policy below, disable RLS on the four tables, revoke the
-- grants (and UPDATE (last_sign_in_on) ON membership FROM shifa_app); the tables and the column go
-- with a contract migration.
ALTER TABLE "announcement" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "announcement" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "announcement" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT (id, version, level, body, starts_at, ends_at, target) ON "announcement" TO shifa_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "announcement" TO shifa_platform;
--> statement-breakpoint
GRANT UPDATE (version, body, level, starts_at, ends_at, target, ended_early, ended_by,
              ended_by_name, updated_at) ON "announcement" TO shifa_platform;
--> statement-breakpoint
-- A cancelled announcement (ended before it started: the only way ends_at <= starts_at arises,
-- since the API refuses such periods) was never shown, and stays out of the clinic's reach.
CREATE POLICY announcement_clinic_read ON "announcement" FOR SELECT TO shifa_app
  USING (current_tenant_id() IS NOT NULL
         AND (ends_at IS NULL OR ends_at > starts_at)
         AND (target = 'all'
              OR EXISTS (SELECT 1 FROM "announcement_target" t
                          WHERE t.tenant_id = current_tenant_id()
                            AND t.announcement_id = "announcement".id)));
--> statement-breakpoint
CREATE POLICY announcement_platform_read ON "announcement" FOR SELECT TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN
         ('announcement.listed', 'announcement.created', 'announcement.edited',
          'announcement.ended'));
--> statement-breakpoint
CREATE POLICY announcement_platform_create ON "announcement" FOR INSERT TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'announcement.created'
              AND created_by = current_user_id() AND version = 1 AND NOT ended_early
              AND created_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes'
              AND updated_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes');
--> statement-breakpoint
CREATE POLICY announcement_platform_change ON "announcement" FOR UPDATE TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN ('announcement.edited', 'announcement.ended'))
  WITH CHECK (current_setting('app.admin_reason', true) IN ('announcement.edited',
                                                             'announcement.ended')
              AND (current_setting('app.admin_reason', true) <> 'announcement.ended'
                   OR (ended_early AND ended_by = current_user_id()))
              AND updated_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes');
--> statement-breakpoint
-- Each action keeps to its columns (security review S2): an end sets only ends_at (now, earlier
-- than any end it had) and who ended it, never the text, period start, target or version, and
-- never twice; an edit never touches who ended it and moves the version by one at most.
CREATE FUNCTION public.announcement_change_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public
  AS $$
DECLARE
  reason text := coalesce(current_setting('app.admin_reason', true), '');
BEGIN
  IF reason = 'announcement.ended' THEN
    IF (NEW.version, NEW.body, NEW.level, NEW.starts_at, NEW.target)
         IS DISTINCT FROM (OLD.version, OLD.body, OLD.level, OLD.starts_at, OLD.target)
       OR OLD.ended_early OR NEW.ends_at IS NULL
       OR NEW.ends_at > now() + interval '5 minutes'
       OR (OLD.ends_at IS NOT NULL AND NEW.ends_at > OLD.ends_at) THEN
      RAISE EXCEPTION 'an end sets the end and who ended it only' USING ERRCODE = '42501';
    END IF;
  ELSIF reason = 'announcement.edited' THEN
    IF (NEW.ended_early, NEW.ended_by, NEW.ended_by_name)
         IS DISTINCT FROM (OLD.ended_early, OLD.ended_by, OLD.ended_by_name)
       OR NEW.version NOT IN (OLD.version, OLD.version + 1) THEN
      RAISE EXCEPTION 'an edit changes the text, level, period or target only'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'an announcement changes only in its edit or end' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.announcement_change_guard() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER announcement_change_guard BEFORE UPDATE ON "announcement"
  FOR EACH ROW EXECUTE FUNCTION public.announcement_change_guard();
--> statement-breakpoint
ALTER TABLE "announcement_target" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "announcement_target" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "announcement_target" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT ON "announcement_target" TO shifa_app;
--> statement-breakpoint
CREATE POLICY announcement_target_tenant_isolation ON "announcement_target"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "announcement_target" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY announcement_target_platform_read ON "announcement_target" FOR SELECT
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN
         ('announcement.listed', 'announcement.created', 'announcement.edited',
          'announcement.ended'));
--> statement-breakpoint
CREATE POLICY announcement_target_platform_select_clinics ON "announcement_target" FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) IN ('announcement.created',
                                                             'announcement.edited'));
--> statement-breakpoint
CREATE POLICY announcement_target_platform_unselect ON "announcement_target" FOR DELETE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'announcement.edited');
--> statement-breakpoint
-- Restrictive: even with a tenant set, shifa_platform reaches targets only in an announcement
-- action, writes them only in created or edited, and deletes them only in edited (a DELETE has no
-- WITH CHECK).
CREATE POLICY announcement_target_platform_only_in_actions ON "announcement_target"
  AS RESTRICTIVE TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN
         ('announcement.listed', 'announcement.created', 'announcement.edited',
          'announcement.ended'))
  WITH CHECK (current_setting('app.admin_reason', true) IN ('announcement.created',
                                                             'announcement.edited'));
--> statement-breakpoint
CREATE POLICY announcement_target_platform_delete_only_in_edit ON "announcement_target"
  AS RESTRICTIVE FOR DELETE TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'announcement.edited');
--> statement-breakpoint
ALTER TABLE "announcement_dismissal" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "announcement_dismissal" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "announcement_dismissal" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT ON "announcement_dismissal" TO shifa_app;
--> statement-breakpoint
GRANT UPDATE (version, dismissed_at, updated_at) ON "announcement_dismissal" TO shifa_app;
--> statement-breakpoint
-- For PUBLIC: announcement_counts() runs as the owner and reads each member's rows by setting
-- app.user_id; shifa_auth and shifa_platform hold no privilege on the table.
CREATE POLICY announcement_dismissal_own_read ON "announcement_dismissal" FOR SELECT
  USING (user_id = current_user_id());
--> statement-breakpoint
CREATE POLICY announcement_dismissal_own_insert ON "announcement_dismissal" FOR INSERT
  TO shifa_app
  WITH CHECK (user_id = current_user_id()
              AND EXISTS (SELECT 1 FROM "announcement" a
                           WHERE a.id = announcement_id
                             AND "announcement_dismissal".version <= a.version));
--> statement-breakpoint
CREATE POLICY announcement_dismissal_own_change ON "announcement_dismissal" FOR UPDATE
  TO shifa_app
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id()
              AND EXISTS (SELECT 1 FROM "announcement" a
                           WHERE a.id = announcement_id
                             AND "announcement_dismissal".version <= a.version));
--> statement-breakpoint
ALTER TABLE "usage_daily" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "usage_daily" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "usage_daily" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "usage_daily" TO shifa_app;
--> statement-breakpoint
CREATE POLICY usage_daily_tenant_isolation ON "usage_daily"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
GRANT SELECT ON "usage_daily" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY usage_daily_platform_read ON "usage_daily" FOR SELECT TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN ('clinic.listed', 'clinic.usage_viewed'));
--> statement-breakpoint
CREATE POLICY usage_daily_platform_only_in_usage ON "usage_daily" AS RESTRICTIVE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN ('clinic.listed', 'clinic.usage_viewed'));
--> statement-breakpoint
GRANT UPDATE (last_sign_in_on) ON "membership" TO shifa_app;
--> statement-breakpoint
-- For each announcement given (its id, current version and whether it is for every clinic), how
-- many non-deactivated members its clinics have and how many of them hid this version; by the
-- announcement's position in the array. Each clinic given is read in turn under its own tenant
-- policies (its targets, its members); each member's dismissals under app.user_id. The caller's
-- tenant and user settings are restored. The guarantee is integers only (ADR-0051, OD-129).
CREATE FUNCTION public.announcement_counts(p_announcements uuid[], p_versions integer[],
                                           p_all boolean[], p_tenants uuid[])
  RETURNS TABLE (ord integer, targeted integer, dismissed integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
DECLARE
  previous_tenant text := coalesce(current_setting('app.tenant_id', true), '');
  previous_user text := coalesce(current_setting('app.user_id', true), '');
  n integer := coalesce(cardinality(p_announcements), 0);
  tg integer[];
  ds integer[];
  aimed integer[];
  members integer;
  t uuid;
  u uuid;
  r record;
BEGIN
  IF coalesce(current_setting('app.admin_reason', true), '')
       NOT IN ('announcement.listed', 'announcement.created', 'announcement.edited',
               'announcement.ended')
     OR p_tenants IS NULL
     OR coalesce(cardinality(p_versions), 0) <> n OR coalesce(cardinality(p_all), 0) <> n THEN
    RAISE EXCEPTION 'announcement_counts runs inside an announcement action of the platform'
      USING ERRCODE = '42501';
  END IF;
  IF n > 10000 OR coalesce(cardinality(p_tenants), 0) > 10000 THEN
    RAISE EXCEPTION 'announcement_counts takes at most 10000 announcements and 10000 clinics'
      USING ERRCODE = '54000';
  END IF;
  IF n = 0 THEN
    RETURN;
  END IF;
  tg := array_fill(0, ARRAY[n]);
  ds := array_fill(0, ARRAY[n]);
  FOR t IN SELECT DISTINCT x FROM unnest(p_tenants) AS x WHERE x IS NOT NULL LOOP
    PERFORM set_config('app.tenant_id', t::text, true);
    SELECT coalesce(array_agg(a.i), '{}') INTO aimed
      FROM unnest(p_announcements, p_all) WITH ORDINALITY AS a(id, everyone, i)
     WHERE a.everyone
        OR EXISTS (SELECT 1 FROM public.announcement_target tr
                    WHERE tr.tenant_id = t AND tr.announcement_id = a.id);
    IF cardinality(aimed) = 0 THEN
      CONTINUE;
    END IF;
    SELECT count(*)::integer INTO members
      FROM public.membership m WHERE m.tenant_id = t AND m.status <> 'deactivated';
    FOR r IN SELECT unnest(aimed) AS i LOOP
      tg[r.i] := tg[r.i] + members;
    END LOOP;
    FOR u IN SELECT m.user_id FROM public.membership m
              WHERE m.tenant_id = t AND m.status <> 'deactivated' AND m.user_id IS NOT NULL LOOP
      PERFORM set_config('app.user_id', u::text, true);
      FOR r IN
        SELECT a.i
          FROM unnest(p_announcements, p_versions) WITH ORDINALITY AS a(id, version, i)
          JOIN public.announcement_dismissal d
            ON d.user_id = u AND d.announcement_id = a.id AND d.version >= a.version
         WHERE a.i = ANY (aimed)
      LOOP
        ds[r.i] := ds[r.i] + 1;
      END LOOP;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.tenant_id', previous_tenant, true);
  PERFORM set_config('app.user_id', previous_user, true);
  RETURN QUERY SELECT g.i, tg[g.i], ds[g.i] FROM generate_series(1, n) AS g(i);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.announcement_counts(uuid[], integer[], boolean[], uuid[]) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.announcement_counts(uuid[], integer[], boolean[], uuid[])
  TO shifa_platform;
--> statement-breakpoint
-- A clinic's non-deactivated members (pending included), its active members and its non-archived
-- branches, for the usage view; the caller's tenant setting is restored.
CREATE FUNCTION public.clinic_member_counts(p_tenant uuid)
  RETURNS TABLE (members integer, active_members integer, branches integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
DECLARE
  previous text := coalesce(current_setting('app.tenant_id', true), '');
BEGIN
  IF coalesce(current_setting('app.admin_reason', true), '') <> 'clinic.usage_viewed'
     OR p_tenant IS NULL THEN
    RAISE EXCEPTION 'clinic_member_counts runs inside the usage view of the platform'
      USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.tenant_id', p_tenant::text, true);
  SELECT count(*) FILTER (WHERE m.status <> 'deactivated')::integer,
         count(*) FILTER (WHERE m.status = 'active')::integer
    INTO members, active_members
    FROM public.membership m WHERE m.tenant_id = p_tenant;
  SELECT count(*)::integer INTO branches
    FROM public.branch b WHERE b.tenant_id = p_tenant AND b.archived_at IS NULL;
  PERFORM set_config('app.tenant_id', previous, true);
  RETURN NEXT;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.clinic_member_counts(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.clinic_member_counts(uuid) TO shifa_platform;
