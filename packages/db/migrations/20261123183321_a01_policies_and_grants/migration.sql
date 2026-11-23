-- A-01-01 (ADR-0043): RLS, privileges and the append-only trigger for the A-01 tables. Runs as
-- shifa_owner. Three application roles (sql/roles.sql): shifa_app (tenant work), shifa_auth
-- (identity, setup links, own memberships), shifa_platform (super-admin work). Tenant
-- isolation policies are for PUBLIC; table privileges are what keep shifa_auth and
-- shifa_platform off clinic data (pinned by test/privileges.test.ts). Every policy for
-- shifa_auth or shifa_platform has its reason in src/schema/classification.ts.
GRANT USAGE ON SCHEMA public TO shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO shifa_auth, shifa_platform;
--> statement-breakpoint
-- The signed-in person (app.user_id), NULL when unset; read by identity and membership policies.
CREATE FUNCTION public.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_user_id() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_user_id() TO shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
-- The SHA-256 (hex) of the setup-link token being opened (app.link_token_hash), NULL when unset.
CREATE FUNCTION public.current_link_token_hash() RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.link_token_hash', true), '') $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_link_token_hash() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_link_token_hash() TO shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint

-- tenant (global): the platform manages it; a clinic reads its own row; a person reads the
-- tenants they are a member of (clinic chooser).
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "tenant" FROM shifa_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "tenant" TO shifa_platform;
--> statement-breakpoint
GRANT SELECT ON "tenant" TO shifa_auth;
--> statement-breakpoint
CREATE POLICY tenant_app_read ON "tenant" FOR SELECT TO shifa_app
  USING (id = current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_platform_all ON "tenant" TO shifa_platform USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY tenant_auth_member_read ON "tenant" FOR SELECT TO shifa_auth
  USING (EXISTS (SELECT 1 FROM "membership" m
                  WHERE m.tenant_id = "tenant".id AND m.user_id = current_user_id()));
--> statement-breakpoint

-- Identity tables (global, personal data): shifa_auth only, except that shifa_app reads the
-- signed-in person's own rows, without secret columns.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user', 'session', 'account', 'two_factor', 'verification',
                           'auth_throttle'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM shifa_app', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO shifa_auth', t);
    EXECUTE format('CREATE POLICY %I ON %I TO shifa_auth USING (true) WITH CHECK (true)',
                   t || '_auth_all', t);
  END LOOP;
END
$$;
--> statement-breakpoint
GRANT SELECT ON "user" TO shifa_app;
--> statement-breakpoint
CREATE POLICY user_self_read ON "user" FOR SELECT TO shifa_app USING (id = current_user_id());
--> statement-breakpoint
GRANT SELECT (id, user_id, expires_at, created_at, updated_at, ip_address, user_agent,
              active_tenant_id, active_branch_id, last_active_at) ON "session" TO shifa_app;
--> statement-breakpoint
CREATE POLICY session_self_read ON "session" FOR SELECT TO shifa_app
  USING (user_id = current_user_id());
--> statement-breakpoint
GRANT SELECT (id, user_id, account_id, provider_id, created_at) ON "account" TO shifa_app;
--> statement-breakpoint
CREATE POLICY account_self_read ON "account" FOR SELECT TO shifa_app
  USING (user_id = current_user_id());
--> statement-breakpoint
GRANT SELECT (id, user_id, verified) ON "two_factor" TO shifa_app;
--> statement-breakpoint
CREATE POLICY two_factor_self_read ON "two_factor" FOR SELECT TO shifa_app
  USING (user_id = current_user_id());
--> statement-breakpoint

-- Tenant tables: ENABLE + FORCE RLS and the tenant isolation policy (/rls-policy).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organization', 'deployment_route', 'branch', 'membership',
                           'role_assignment', 'permission_override', 'setup_link'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id = current_tenant_id()) '
                   'WITH CHECK (tenant_id = current_tenant_id())', t || '_tenant_isolation', t);
  END LOOP;
END
$$;
--> statement-breakpoint
-- createClinic(): shifa_platform inserts the clinic's first rows under the tenant context it
-- sets in that transaction (INSERT only: super admins see no clinic data).
GRANT INSERT ON "organization", "branch" TO shifa_platform;
--> statement-breakpoint
-- deployment_route: read-only for a clinic; the platform routes and moves tenants.
REVOKE INSERT, UPDATE, DELETE ON "deployment_route" FROM shifa_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "deployment_route" TO shifa_platform;
--> statement-breakpoint
CREATE POLICY deployment_route_platform_read ON "deployment_route" FOR SELECT TO shifa_platform
  USING (true);
--> statement-breakpoint
CREATE POLICY deployment_route_platform_move ON "deployment_route" FOR UPDATE TO shifa_platform
  USING (true) WITH CHECK (true);
--> statement-breakpoint
-- membership: a person's own memberships across tenants (clinic chooser, sign-in).
GRANT SELECT ON "membership" TO shifa_auth;
--> statement-breakpoint
CREATE POLICY membership_auth_own_read ON "membership" FOR SELECT TO shifa_auth
  USING (user_id = current_user_id());
--> statement-breakpoint
-- setup_link: one link by its token hash; only `used_at` may be set.
GRANT SELECT, UPDATE (used_at) ON "setup_link" TO shifa_auth;
--> statement-breakpoint
CREATE POLICY setup_link_auth_read ON "setup_link" FOR SELECT TO shifa_auth
  USING (token_hash = current_link_token_hash());
--> statement-breakpoint
CREATE POLICY setup_link_auth_use ON "setup_link" FOR UPDATE TO shifa_auth
  USING (token_hash = current_link_token_hash())
  WITH CHECK (token_hash = current_link_token_hash());
--> statement-breakpoint

-- audit_event: append-only (no UPDATE or DELETE privilege; the trigger refuses even the owner).
ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON "audit_event" FROM shifa_app;
--> statement-breakpoint
GRANT INSERT ON "audit_event" TO shifa_auth, shifa_platform;
--> statement-breakpoint
CREATE POLICY audit_event_tenant_read ON "audit_event" FOR SELECT
  USING (tenant_id = current_tenant_id());
--> statement-breakpoint
CREATE POLICY audit_event_tenant_insert ON "audit_event" FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
--> statement-breakpoint
CREATE POLICY audit_event_auth_insert ON "audit_event" FOR INSERT TO shifa_auth
  WITH CHECK (tenant_id IS NULL);
--> statement-breakpoint
CREATE POLICY audit_event_platform_insert ON "audit_event" FOR INSERT TO shifa_platform
  WITH CHECK (tenant_id IS NULL);
--> statement-breakpoint
CREATE FUNCTION public.audit_event_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'audit_event is append-only' USING ERRCODE = '42501'; END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_event_append_only() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_event_append_only();
