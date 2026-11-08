-- Cluster-level roles (not in Drizzle migrations: roles are shared by every database in a
-- cluster). Idempotent; run by the test harness and later by deployment, as a superuser.
--
-- shifa_owner: owns the schema and runs migrations. NOLOGIN in production (a deploy job
--              switches to it); the test harness gives it a password.
-- shifa_app:   what the application connects as. Never superuser, never BYPASSRLS, owns
--              nothing, so FORCE ROW LEVEL SECURITY always applies to it (ADR-0004).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shifa_owner') THEN
    CREATE ROLE shifa_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shifa_app') THEN
    CREATE ROLE shifa_app LOGIN;
  END IF;
END
$$;

-- Re-assert the safety attributes on every run, in case someone changed them by hand.
ALTER ROLE shifa_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE shifa_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

-- shifa_app must not be a member of any role: through membership (even indirect) it could
-- SET ROLE to the owner and switch RLS off. Fail loudly instead of repairing silently.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_auth_members WHERE member = 'shifa_app'::regrole) THEN
    RAISE EXCEPTION 'shifa_app is a member of another role; revoke it (RLS bypass via SET ROLE)';
  END IF;
END
$$;
