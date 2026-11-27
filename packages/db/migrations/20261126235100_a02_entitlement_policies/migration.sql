-- A-02-02 (expand): seeds, row security, grants and the use-count function of the entitlement
-- tables (20261126235059_a02_entitlements). Runs as shifa_owner.
-- * plan, plan_feature, addon (global, no clinic data): every role reads them; nobody but the owner
--   (migrations) writes them. Seeded before RLS: one plan per clinic type with the limit defaults.
-- * tenant_addon, tenant_override (tenant): shifa_app reads its own; shifa_platform reads them
--   inside the clinic's tenant context in entitlement actions only and writes overrides only in
--   entitlement.override_set / _removed.
-- * tenant_override_event (tenant): shifa_app reads its own; shifa_platform reads it and appends
--   in the actions that change a key; nobody updates or deletes it (no privilege, and a trigger).
-- * tenant_usage_counts(uuid): the integers a type preview needs (doctors, branches), for
--   shifa_platform inside a platform action only; no row or name leaves it (spec A-02, "Money,
--   abuse and privacy"; the ADR amending ADR-0043 comes with A-02-06).
-- Every policy for shifa_platform has its reason in src/schema/classification.ts.
-- Rollback: drop the function, the trigger and its function, every policy below, disable RLS on
-- the six tables, revoke the grants; the tables themselves go with a contract migration.
INSERT INTO "plan" ("type") VALUES ('solo'), ('multi_doctor'), ('multi_branch');
--> statement-breakpoint
INSERT INTO "plan_feature" ("plan_type", "key", "value") VALUES
  ('solo', 'limits.practitioners', '1'),
  ('solo', 'limits.branches', '1'),
  ('solo', 'limits.custom_fields', '20'),
  ('multi_doctor', 'limits.practitioners', '10'),
  ('multi_doctor', 'limits.branches', '1'),
  ('multi_doctor', 'limits.custom_fields', '20'),
  ('multi_branch', 'limits.practitioners', '30'),
  ('multi_branch', 'limits.branches', '5'),
  ('multi_branch', 'limits.custom_fields', '20');
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plan', 'plan_feature', 'addon'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %I FROM shifa_app', t);
    EXECUTE format('GRANT SELECT ON %I TO shifa_platform', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', t || '_read', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['tenant_addon', 'tenant_override', 'tenant_override_event'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %I FROM shifa_app', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id = current_tenant_id()) '
                   'WITH CHECK (tenant_id = current_tenant_id())', t || '_tenant_isolation', t);
    EXECUTE format('GRANT SELECT ON %I TO shifa_platform', t);
    -- Restrictive: with a tenant set, shifa_platform reads these only in an entitlement action.
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE FOR SELECT TO shifa_platform '
                   'USING (current_setting(''app.admin_reason'', true) IN ('
                   '''entitlement.viewed'', ''entitlement.history_viewed'', '
                   '''entitlement.override_set'', ''entitlement.override_removed'', '
                   '''clinic.type_previewed'', ''clinic.type_changed''))',
                   t || '_platform_read_only_in_actions', t);
  END LOOP;
END
$$;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON "tenant_override" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY tenant_override_platform_set_only ON "tenant_override" AS RESTRICTIVE FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'entitlement.override_set');
--> statement-breakpoint
CREATE POLICY tenant_override_platform_change_only ON "tenant_override" AS RESTRICTIVE FOR UPDATE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'entitlement.override_set')
  WITH CHECK (current_setting('app.admin_reason', true) = 'entitlement.override_set');
--> statement-breakpoint
CREATE POLICY tenant_override_platform_remove_only ON "tenant_override" AS RESTRICTIVE FOR DELETE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'entitlement.override_removed');
--> statement-breakpoint
GRANT INSERT ON "tenant_override_event" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY tenant_override_event_platform_append_only ON "tenant_override_event" AS RESTRICTIVE
  FOR INSERT TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true)
              IN ('entitlement.override_set', 'entitlement.override_removed', 'clinic.type_changed'));
--> statement-breakpoint
CREATE FUNCTION public.tenant_override_event_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'tenant_override_event is append-only' USING ERRCODE = '42501'; END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.tenant_override_event_append_only() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER tenant_override_event_append_only BEFORE UPDATE OR DELETE ON "tenant_override_event"
  FOR EACH STATEMENT EXECUTE FUNCTION public.tenant_override_event_append_only();
--> statement-breakpoint
-- Runs as its owner (FORCE RLS still applies): the clinic is set as tenant for the two counts and
-- the caller's setting restored. Only inside a platform action (app.admin_reason set).
CREATE FUNCTION public.tenant_usage_counts(p_tenant uuid)
  RETURNS TABLE (practitioners integer, branches integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
DECLARE
  previous text := coalesce(current_setting('app.tenant_id', true), '');
BEGIN
  IF coalesce(current_setting('app.admin_reason', true), '') = '' OR p_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant_usage_counts runs inside a platform action' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.tenant_id', p_tenant::text, true);
  SELECT count(DISTINCT m.id)::integer INTO practitioners
    FROM public.membership m
    JOIN public.role_assignment ra ON ra.tenant_id = m.tenant_id AND ra.membership_id = m.id
   WHERE m.tenant_id = p_tenant AND ra.role = 'doctor' AND m.status <> 'deactivated';
  SELECT count(*)::integer INTO branches
    FROM public.branch b WHERE b.tenant_id = p_tenant AND b.archived_at IS NULL;
  PERFORM set_config('app.tenant_id', previous, true);
  RETURN NEXT;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.tenant_usage_counts(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.tenant_usage_counts(uuid) TO shifa_platform;
