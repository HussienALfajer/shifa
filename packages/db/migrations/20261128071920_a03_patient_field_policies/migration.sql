-- A-03-05 (expand): row security and grants of the custom field definitions
-- (20261128071915_a03_patient_fields), and the super admin's count of them. Runs as shifa_owner,
-- which is NOBYPASSRLS.
-- * patient_field (tenant): a clinic's field definitions (spec A-03 criteria 14–17). shifa_app
--   reads, adds and updates its own clinic's rows; a field is never deleted (a purged field stays
--   as a tombstone so its key is never reused), so no DELETE.
-- * patient_field_option (tenant): a choice field's choices; renamed, reordered or archived,
--   never deleted (criterion 14), so no DELETE.
-- * tenant_custom_field_count(uuid, bigint) (ADR-0051): `limits.custom_fields` use beside the
--   clinic's limits in the super admin's entitlement view and type preview (criterion 15): active
--   fields plus those archived after the cutoff the API passes (its clock less 30 days, in epoch
--   seconds: the API's clock decides, as for every time rule). One integer, in the same platform
--   actions as tenant_usage_counts().
-- shifa_auth and shifa_platform hold nothing on either table.
-- Rollback: drop the function, the policies, disable RLS and revoke the grants; the tables go with
-- a contract migration.
ALTER TABLE "patient_field" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_field" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient_field" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "patient_field" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_field_tenant_isolation ON "patient_field"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
ALTER TABLE "patient_field_option" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_field_option" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient_field_option" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "patient_field_option" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_field_option_tenant_isolation ON "patient_field_option"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
-- Runs as its owner (FORCE RLS still applies): the clinic is set as tenant for the count and the
-- caller's setting restored, as tenant_usage_counts() does.
CREATE FUNCTION public.tenant_custom_field_count(p_tenant uuid, p_archived_after_epoch bigint)
  RETURNS TABLE (custom_fields integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
DECLARE
  previous text := coalesce(current_setting('app.tenant_id', true), '');
BEGIN
  IF coalesce(current_setting('app.admin_reason', true), '')
       NOT IN ('clinic.type_previewed', 'clinic.type_changed', 'entitlement.viewed',
               'entitlement.override_set', 'entitlement.override_removed')
     OR p_tenant IS NULL OR p_archived_after_epoch IS NULL THEN
    RAISE EXCEPTION 'tenant_custom_field_count runs inside a type preview or change or an entitlement action'
      USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.tenant_id', p_tenant::text, true);
  SELECT count(*)::integer INTO custom_fields
    FROM public.patient_field f
   WHERE f.tenant_id = p_tenant
     AND (f.state = 'active'
          OR (f.state = 'archived' AND f.archived_at > to_timestamp(p_archived_after_epoch)));
  PERFORM set_config('app.tenant_id', previous, true);
  RETURN NEXT;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.tenant_custom_field_count(uuid, bigint) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.tenant_custom_field_count(uuid, bigint) TO shifa_platform;
