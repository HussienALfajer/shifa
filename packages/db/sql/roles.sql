-- Cluster-level roles (not in Drizzle migrations: roles are shared by every database in a
-- cluster). Idempotent; run by the test harness and later by deployment, as a superuser.
--
-- shifa_owner:    owns the schema and runs migrations. NOLOGIN in production (a deploy job
--                 switches to it); the test harness gives it a password.
-- shifa_app:      what the application connects as for tenant work (withTenant()). Never
--                 superuser, never BYPASSRLS, owns nothing, so FORCE ROW LEVEL SECURITY always
--                 applies to it (ADR-0004).
-- shifa_auth:     the identity path (Better Auth adapter, setup-link lookup, a person's own
--                 memberships across tenants); ADR-0043.
-- shifa_platform: the super-admin path (withPlatformAdmin(), audited); ADR-0043, ADR-0005.
-- The three application roles have the same safety attributes; what each reaches is set by
-- table privileges and policies in the migrations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shifa_owner') THEN
    CREATE ROLE shifa_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shifa_app') THEN
    CREATE ROLE shifa_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shifa_auth') THEN
    CREATE ROLE shifa_auth LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shifa_platform') THEN
    CREATE ROLE shifa_platform LOGIN;
  END IF;
END
$$;

-- Re-assert the safety attributes on every run, in case someone changed them by hand.
ALTER ROLE shifa_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE shifa_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
ALTER ROLE shifa_auth LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
ALTER ROLE shifa_platform LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

-- No application role may be a member of any role: through membership (even indirect) it could
-- SET ROLE to the owner and switch RLS off. Fail loudly instead of repairing silently.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['shifa_app', 'shifa_auth', 'shifa_platform'] LOOP
    IF EXISTS (SELECT FROM pg_auth_members WHERE member = r::regrole) THEN
      RAISE EXCEPTION '% is a member of another role; revoke it (RLS bypass via SET ROLE)', r;
    END IF;
  END LOOP;
END
$$;
