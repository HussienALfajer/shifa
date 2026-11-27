-- A-02-03 (expand): row security and grants of the flag tables (20261127010323_a02_feature_flags),
-- and the use counts for the super admin's entitlement view. Runs as shifa_owner.
-- * feature_flag (global, no clinic data): every role reads it; shifa_platform inserts and updates
--   it only in a flag.changed action; shifa_app writes nothing.
-- * feature_flag_tenant (tenant): shifa_app reads its own clinic's rows only; shifa_platform reads
--   every clinic's rows in flag.listed and flag.changed only (tenant ids, no clinic data) and
--   inserts and deletes them only in flag.changed.
-- * tenant_usage_counts(uuid): also answers in entitlement.viewed, entitlement.override_set and
--   entitlement.override_removed, so «الاشتراك والحدود» shows use beside each limit (contract
--   field `used`). Integers only, as before.
-- Every policy for shifa_platform has its reason in src/schema/classification.ts.
-- Rollback: restore the earlier body of tenant_usage_counts (20261126235100), drop every policy
-- below, disable RLS on both tables and revoke the grants; the tables go with a contract migration.
ALTER TABLE "feature_flag" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "feature_flag" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "feature_flag" FROM shifa_app;
--> statement-breakpoint
CREATE POLICY feature_flag_read ON "feature_flag" FOR SELECT USING (true);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "feature_flag" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY feature_flag_platform_set ON "feature_flag" FOR INSERT TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'flag.changed');
--> statement-breakpoint
CREATE POLICY feature_flag_platform_change ON "feature_flag" FOR UPDATE TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'flag.changed')
  WITH CHECK (current_setting('app.admin_reason', true) = 'flag.changed');
--> statement-breakpoint
ALTER TABLE "feature_flag_tenant" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "feature_flag_tenant" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "feature_flag_tenant" FROM shifa_app;
--> statement-breakpoint
CREATE POLICY feature_flag_tenant_tenant_isolation ON "feature_flag_tenant"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "feature_flag_tenant" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY feature_flag_tenant_platform_read ON "feature_flag_tenant" FOR SELECT
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN ('flag.listed', 'flag.changed'));
--> statement-breakpoint
CREATE POLICY feature_flag_tenant_platform_select_clinics ON "feature_flag_tenant" FOR INSERT
  TO shifa_platform
  WITH CHECK (current_setting('app.admin_reason', true) = 'flag.changed');
--> statement-breakpoint
CREATE POLICY feature_flag_tenant_platform_unselect ON "feature_flag_tenant" FOR DELETE
  TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'flag.changed');
--> statement-breakpoint
-- Restrictive: even with a tenant set (inTenantContext in other actions), shifa_platform reaches
-- these rows only in a flag action, and writes them only in flag.changed.
CREATE POLICY feature_flag_tenant_platform_only_in_flag_actions ON "feature_flag_tenant"
  AS RESTRICTIVE TO shifa_platform
  USING (current_setting('app.admin_reason', true) IN ('flag.listed', 'flag.changed'))
  WITH CHECK (current_setting('app.admin_reason', true) = 'flag.changed');
--> statement-breakpoint
-- Restrictive: a DELETE has no WITH CHECK, so the policy above alone would let flag.listed delete
-- a clinic's selection inside its tenant context (review N3).
CREATE POLICY feature_flag_tenant_platform_delete_only_in_change ON "feature_flag_tenant"
  AS RESTRICTIVE FOR DELETE TO shifa_platform
  USING (current_setting('app.admin_reason', true) = 'flag.changed');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.tenant_usage_counts(p_tenant uuid)
  RETURNS TABLE (practitioners integer, branches integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
DECLARE
  previous text := coalesce(current_setting('app.tenant_id', true), '');
BEGIN
  IF coalesce(current_setting('app.admin_reason', true), '')
       NOT IN ('clinic.type_previewed', 'clinic.type_changed', 'entitlement.viewed',
               'entitlement.override_set', 'entitlement.override_removed')
     OR p_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant_usage_counts runs inside a type preview or change or an entitlement action'
      USING ERRCODE = '42501';
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
