-- A-02-06 (expand + seed + contract): row security, grants and the first list of the place tables
-- (20261127081513_a02_places), the counts across clinics, and the contract step of A-02-04.
-- Runs as shifa_owner, which is NOBYPASSRLS.
-- * Seed: Aleppo (حلب) with its main neighbourhoods and Azaz (أعزاز), drafted by us for the owner's
--   review in the PR (real public place names, no people). Written before RLS is enabled on the
--   two tables, so the owner's inserts land (no temporary owner policy needed). `name_key` is
--   placeKey(name) of @shifa/contracts; apps/api/test/places/seed.test.ts checks every row.
-- * city, area (global, no clinic data): every application role but shifa_auth reads them;
--   shifa_platform inserts only in city.created / area.created (created now, not archived) and
--   updates by column (name, name_key, archived_at, updated_at) only in a rename, archive or
--   restore of its kind; the trigger place_change_guard() keeps a rename to the name and an archive
--   or restore to archived_at. No role deletes a place (no DELETE grant): ids stay on branches.
--   Times are bounded by the database's clock within 5 minutes of now (the API stamps rows).
-- * place_counts(text, uuid[], uuid[]) (SECURITY DEFINER, ADR-0051): for each place given, how
--   many non-archived branches hold it, in how many clinics, and how many non-deactivated doctors
--   work there; integers only (the place's position in the array, never an id or a name), for
--   shifa_platform alone, in its place actions only. It reads each clinic given in turn under that
--   clinic's own tenant policies (as tenant_usage_counts() does) and restores the caller's tenant.
--   The guarantee is integers only: the clinics are the caller's list (placeCounts() passes every
--   clinic from `tenant`), so a caller that passes one clinic gets that clinic's figures per place,
--   the same class as tenant_usage_counts() (accepted risk, OD-129). Both arrays are capped at
--   10000 entries.
-- * Contract of A-02-04 (after it is deployed; before real data): tenant.idle_minutes and its check
--   went in the migration before; here shifa_app loses UPDATE (updated_at) on tenant and the
--   policy tenant_app_settings, which existed only for the idle setting. shifa_app now reads its
--   tenant row only. Deploy with no instance of an earlier API serving: its tenant reads name
--   every column, idle_minutes included.
-- Every policy for shifa_platform has its reason in src/schema/classification.ts, and the function
-- is listed there (COUNT_FUNCTIONS) and pinned in test/privileges.test.ts.
-- Rollback: drop the function, the trigger and its function, every policy below, disable RLS on
-- city and area and revoke the grants; re-add tenant.idle_minutes (smallint not null default 30,
-- check in (15, 30, 60)), GRANT UPDATE (idle_minutes, updated_at) ON tenant TO shifa_app and the
-- policy tenant_app_settings (as in 20261123223448); the earlier code then reads 30 for every
-- clinic (values set through the cascade are not copied back).
INSERT INTO "city" ("name", "name_key") VALUES ('حلب', 'حلب'), ('أعزاز', 'اعزاز');
--> statement-breakpoint
INSERT INTO "area" ("city_id", "name", "name_key")
  SELECT c.id, a.name, a.name_key
    FROM "city" c,
         (VALUES
           ('العزيزية', 'العزيزيه'),
           ('الجميلية', 'الجميليه'),
           ('السليمانية', 'السليمانيه'),
           ('الشهباء', 'الشهباء'),
           ('الفرقان', 'الفرقان'),
           ('الموكامبو', 'الموكامبو'),
           ('حلب الجديدة', 'حلب الجديده'),
           ('الحمدانية', 'الحمدانيه'),
           ('صلاح الدين', 'صلاح الدين'),
           ('سيف الدولة', 'سيف الدوله'),
           ('الأشرفية', 'الاشرفيه'),
           ('الشيخ مقصود', 'الشيخ مقصود'),
           ('الميدان', 'الميدان'),
           ('باب الفرج', 'باب الفرج'),
           ('السبيل', 'السبيل'),
           ('المحافظة', 'المحافظه'),
           ('الشعار', 'الشعار'),
           ('الصاخور', 'الصاخور'),
           ('الكلاسة', 'الكلاسه'),
           ('السكري', 'السكري'),
           ('الأنصاري', 'الانصاري'),
           ('المشهد', 'المشهد'),
           ('الفردوس', 'الفردوس'),
           ('باب النيرب', 'باب النيرب'),
           ('الجديدة', 'الجديده'),
           ('الإذاعة', 'الاذاعه'),
           ('الخالدية', 'الخالديه'),
           ('الأعظمية', 'الاعظميه'),
           ('الزهراء', 'الزهراء'),
           ('الحيدرية', 'الحيدريه'),
           ('هنانو', 'هنانو'),
           ('بستان القصر', 'بستان القصر'),
           ('المرجة', 'المرجه'),
           ('الصالحين', 'الصالحين'),
           ('الشيخ طه', 'الشيخ طه'),
           ('السريان', 'السريان'),
           ('الميريديان', 'الميريديان'),
           ('الأكرمية', 'الاكرميه'),
           ('النيل', 'النيل'),
           ('الإسماعيلية', 'الاسماعيليه'),
           ('الهلك', 'الهلك'),
           ('الراموسة', 'الراموسه'),
           ('الشيخ سعيد', 'الشيخ سعيد'),
           ('الفيض', 'الفيض')) AS a(name, name_key)
   WHERE c.name_key = 'حلب';
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['city', 'area'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM shifa_app, shifa_auth, shifa_platform', t);
    EXECUTE format('GRANT SELECT ON %I TO shifa_app, shifa_platform', t);
    EXECUTE format('GRANT INSERT ON %I TO shifa_platform', t);
    EXECUTE format('GRANT UPDATE (name, name_key, archived_at, updated_at) ON %I TO shifa_platform', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', t || '_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO shifa_platform WITH CHECK ('
      'current_setting(''app.admin_reason'', true) = %L AND archived_at IS NULL '
      'AND created_at BETWEEN now() - interval ''5 minutes'' AND now() + interval ''5 minutes'' '
      'AND updated_at BETWEEN now() - interval ''5 minutes'' AND now() + interval ''5 minutes'')',
      t || '_platform_create', t, t || '.created');
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO shifa_platform '
      'USING (current_setting(''app.admin_reason'', true) IN (%L, %L, %L)) '
      'WITH CHECK (current_setting(''app.admin_reason'', true) IN (%L, %L, %L) '
      'AND updated_at BETWEEN now() - interval ''5 minutes'' AND now() + interval ''5 minutes'' '
      'AND (archived_at IS NULL OR current_setting(''app.admin_reason'', true) <> %L '
      '     OR archived_at BETWEEN now() - interval ''5 minutes'' AND now() + interval ''5 minutes''))',
      t || '_platform_change', t,
      t || '.renamed', t || '.archived', t || '.restored',
      t || '.renamed', t || '.archived', t || '.restored',
      t || '.archived');
  END LOOP;
END $$;
--> statement-breakpoint
-- A rename changes the name only, an archive sets archived_at, a restore clears it; an area stays
-- in its city and no place changes its id (no column grant either). The owner is bound by FORCE
-- RLS with no UPDATE policy of its own, so an owner's UPDATE changes 0 rows: a later migration that
-- edits the list runs ALTER TABLE … NO FORCE ROW LEVEL SECURITY, sets the matching
-- app.admin_reason with set_config(…, true) for this trigger, edits the rows, checks ROW_COUNT and
-- RAISEs on a mismatch, then runs ALTER TABLE … FORCE ROW LEVEL SECURITY again.
CREATE FUNCTION public.place_change_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public
  AS $$
DECLARE
  reason text := coalesce(current_setting('app.admin_reason', true), '');
BEGIN
  IF (NEW.name, NEW.name_key) IS DISTINCT FROM (OLD.name, OLD.name_key)
     AND reason <> TG_ARGV[0] || '.renamed' THEN
    RAISE EXCEPTION 'a place is renamed only in its rename action' USING ERRCODE = '42501';
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NOT ((reason = TG_ARGV[0] || '.archived' AND OLD.archived_at IS NULL
               AND NEW.archived_at IS NOT NULL)
              OR (reason = TG_ARGV[0] || '.restored' AND OLD.archived_at IS NOT NULL
                  AND NEW.archived_at IS NULL)) THEN
    RAISE EXCEPTION 'a place is archived or restored only in that action' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.place_change_guard() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER city_change_guard BEFORE UPDATE ON "city"
  FOR EACH ROW EXECUTE FUNCTION public.place_change_guard('city');
--> statement-breakpoint
CREATE TRIGGER area_change_guard BEFORE UPDATE ON "area"
  FOR EACH ROW EXECUTE FUNCTION public.place_change_guard('area');
--> statement-breakpoint
CREATE FUNCTION public.place_counts(p_kind text, p_places uuid[], p_tenants uuid[])
  RETURNS TABLE (ord integer, branches integer, clinics integer, doctors integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
DECLARE
  previous text := coalesce(current_setting('app.tenant_id', true), '');
  n integer := coalesce(cardinality(p_places), 0);
  b integer[];
  c integer[];
  d integer[];
  t uuid;
  r record;
BEGIN
  IF coalesce(current_setting('app.admin_reason', true), '')
       NOT IN ('city.listed', 'city.created', 'city.renamed', 'city.archived', 'city.restored',
               'area.created', 'area.renamed', 'area.archived', 'area.restored')
     OR p_kind IS NULL OR p_kind NOT IN ('city', 'area') OR p_tenants IS NULL THEN
    RAISE EXCEPTION 'place_counts runs inside a place action of the platform'
      USING ERRCODE = '42501';
  END IF;
  IF n > 10000 OR coalesce(cardinality(p_tenants), 0) > 10000 THEN
    RAISE EXCEPTION 'place_counts takes at most 10000 places and 10000 clinics'
      USING ERRCODE = '54000';
  END IF;
  IF n = 0 THEN
    RETURN;
  END IF;
  b := array_fill(0, ARRAY[n]);
  c := array_fill(0, ARRAY[n]);
  d := array_fill(0, ARRAY[n]);
  FOR t IN SELECT DISTINCT x FROM unnest(p_tenants) AS x WHERE x IS NOT NULL LOOP
    PERFORM set_config('app.tenant_id', t::text, true);
    FOR r IN
      WITH places AS (SELECT p.id, p.i::integer AS i
                        FROM unnest(p_places) WITH ORDINALITY AS p(id, i)),
           held AS (SELECT pl.i, br.id AS branch_id
                      FROM places pl
                      JOIN public.branch br
                        ON br.tenant_id = t AND br.archived_at IS NULL
                       AND pl.id = CASE WHEN p_kind = 'city' THEN br.city_id ELSE br.area_id END)
      SELECT h.i,
             count(DISTINCT h.branch_id)::integer AS nb,
             (SELECT count(DISTINCT m.id)::integer
                FROM public.membership m
                JOIN public.role_assignment ra
                  ON ra.tenant_id = m.tenant_id AND ra.membership_id = m.id
               WHERE m.tenant_id = t AND m.status <> 'deactivated' AND ra.role = 'doctor'
                 AND (ra.branch_id IS NULL
                      OR ra.branch_id IN (SELECT h2.branch_id FROM held h2 WHERE h2.i = h.i)))
               AS nd
        FROM held h
       GROUP BY h.i
    LOOP
      b[r.i] := b[r.i] + r.nb;
      c[r.i] := c[r.i] + 1;
      d[r.i] := d[r.i] + r.nd;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.tenant_id', previous, true);
  RETURN QUERY SELECT g.i, b[g.i], c[g.i], d[g.i] FROM generate_series(1, n) AS g(i);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.place_counts(text, uuid[], uuid[]) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.place_counts(text, uuid[], uuid[]) TO shifa_platform;
--> statement-breakpoint
DROP POLICY tenant_app_settings ON "tenant";
--> statement-breakpoint
REVOKE UPDATE ON "tenant" FROM shifa_app;
