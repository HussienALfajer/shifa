-- A-03-03 (expand): row security and grants of the name tokens (20261127211025_a03_name_tokens),
-- and pg_trgm for ranking the matched charts. Runs as shifa_owner, which is NOBYPASSRLS.
-- * patient_name_token (tenant, personal data: parts of names): shifa_app reads, writes and
--   deletes its own clinic's tokens; the chart repository rewrites a chart's tokens on every name
--   change, in the transaction that saves the chart (ADR-0052). shifa_auth and shifa_platform hold
--   nothing on it.
-- * pg_trgm (a trusted extension): `similarity()` ranks the charts the token index matched and
--   the short candidate list of the typo fallback; no trigram index and no LEAKPROOF change
--   (OD-42). Its functions stay executable by PUBLIC, as every built-in function is.
-- Backfill: the charts of A-03-02 keep `name_key_version = 0` here; the API writes their key and
-- tokens with the TypeScript normaliser before a clinic's searches (ADR-0052), because the key is
-- never computed in SQL (ADR-0034).
-- Rollback: drop the policy, disable RLS and revoke the grants; the table, the columns and the
-- extension go with a contract migration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE "patient_name_token" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_name_token" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "patient_name_token" FROM shifa_app, shifa_auth, shifa_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "patient_name_token" TO shifa_app;
--> statement-breakpoint
CREATE POLICY patient_name_token_tenant_isolation ON "patient_name_token"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
