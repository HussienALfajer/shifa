-- Spike 0.3-S3 search tables, in their own schema `s3` (never in packages/db/migrations). Applied
-- as shifa_owner, idempotent. Same tenancy rules as `public`: tenant_id on every row, ENABLE +
-- FORCE RLS, a policy on public.current_tenant_id(), reached by the app only through withTenant().
-- Two key strategies side by side (criterion 10):
--   patient_a.name_key: stored column written by the application (normaliseName in TypeScript);
--   patient_b.name_key: generated column from the IMMUTABLE SQL port s3.normalise_name().
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE SCHEMA IF NOT EXISTS s3;
REVOKE ALL ON SCHEMA s3 FROM PUBLIC;
GRANT USAGE ON SCHEMA s3 TO shifa_app;

-- The SQL port of the normaliser: the same steps in the same order as normalise.ts. Code points
-- are written as regex escapes (\xHHHH) so invisible characters stay visible.
--   1 NFC  2 remove marks, tatweel, bidi controls  3 fold alef forms and hamza carriers
--   4 word-final ة → ه, ى → ي (not followed by an Arabic letter)  5 Arabic-Indic and Persian digits
--   6 ASCII A–Z lower-cased  7 whitespace collapsed and trimmed  8 particles joined (two passes)
--   9 NFC again (removals can bring a base letter and a combining mark together)
CREATE OR REPLACE FUNCTION s3.normalise_name(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
RETURN normalize(
  regexp_replace(
    regexp_replace(
      btrim(
        regexp_replace(
          translate(
            translate(
              regexp_replace(
                regexp_replace(
                  translate(
                    regexp_replace(
                      normalize(input, NFC),
                      '[\x064B-\x065F\x0670\x06D6-\x06ED\x0640\x200E\x200F\x202A-\x202E\x2066-\x2069]',
                      '', 'g'),
                    'أإآٱؤئ', 'ااااوي'),
                  '\x0629(?![\x0620-\x063F\x0641-\x064A\x066E\x066F\x0671-\x06D3\x06D5\x06EE\x06EF\x06FA-\x06FC\x06FF])',
                  'ه', 'g'),
                '\x0649(?![\x0620-\x063F\x0641-\x064A\x066E\x066F\x0671-\x06D3\x06D5\x06EE\x06EF\x06FA-\x06FC\x06FF])',
                'ي', 'g'),
              '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),
          '[\t\n\v\f\r \x0085\x00A0\x1680\x2000-\x200D\x2028\x2029\x202F\x205F\x3000\xFEFF]+',
          ' ', 'g'),
        ' '),
      '(?<=^| )(عبد|ابو|ابي|ام|ابن|بن|بنت) ', '\1', 'g'),
    '(?<=^| )(عبد|ابو|ابي|ام|ابن|بن|بنت) ', '\1', 'g'),
  NFC);
-- Inserting into patient_b runs the generated column's function as the inserting role.
REVOKE ALL ON FUNCTION s3.normalise_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION s3.normalise_name(text) TO shifa_app;

CREATE TABLE IF NOT EXISTS s3.patient_a (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  display_name text NOT NULL,
  name_key text NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS s3.patient_b (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  id uuid NOT NULL,
  display_name text NOT NULL,
  name_key text GENERATED ALWAYS AS (s3.normalise_name(display_name)) STORED,
  PRIMARY KEY (tenant_id, id)
);

-- tenant_id leads (btree_gin), so the index serves the policy predicate and the trigram match.
CREATE INDEX IF NOT EXISTS patient_a_name_key ON s3.patient_a
  USING gin (tenant_id, name_key gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patient_b_name_key ON s3.patient_b
  USING gin (tenant_id, name_key gin_trgm_ops);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_a', 'patient_b'] LOOP
    EXECUTE format('ALTER TABLE s3.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE s3.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON s3.%I', t);
    -- No TO clause: the owner is held to the tenant context too (FORCE) and seeds tenant by
    -- tenant inside a transaction with app.tenant_id set, like the application.
    EXECUTE format('CREATE POLICY tenant_isolation ON s3.%I
                      USING (tenant_id = public.current_tenant_id())
                      WITH CHECK (tenant_id = public.current_tenant_id())', t);
    EXECUTE format('REVOKE ALL ON s3.%I FROM PUBLIC, shifa_app', t);
    EXECUTE format('GRANT SELECT, INSERT ON s3.%I TO shifa_app', t);
  END LOOP;
END
$$;
