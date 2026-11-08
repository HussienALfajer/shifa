-- Baseline (runs as shifa_owner): extension, schema privileges and the tenant-context helper
-- that every RLS policy uses. Roles come from sql/roles.sql (cluster-level, not a migration).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Nobody gets schema rights by default; shifa_app gets exactly what it needs.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO shifa_app;
--> statement-breakpoint
-- Every table and sequence shifa_owner creates later is usable by shifa_app (rows still
-- filtered by FORCE RLS); shifa_app can never create, alter or own anything.
ALTER DEFAULT PRIVILEGES FOR ROLE shifa_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shifa_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE shifa_owner IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO shifa_app;
--> statement-breakpoint
-- The tenant of the current transaction, set by withTenant() with set_config(..., true).
-- NULL when unset: a transaction-local setting reads back as '' after it ends, so '' is NULL too,
-- and `tenant_id = NULL` matches no row.
CREATE FUNCTION public.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO shifa_app;
