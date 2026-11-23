// A-01a criterion 16 (backlog "real OpenAPI 3.1 validation"): the generated document passes the
// OpenAPI 3.1 document schema, and every component is a JSON Schema 2020-12 that compiles.
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApiDocument, type OpenApiDocument } from '../../src/platform/contract/openapi.ts';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';

const OAS_SCHEMA = JSON.parse(
  readFileSync(new URL('./fixtures/oas-3.1-schema-2022-10-07.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

function documentValidator() {
  // Formats (uri-reference, email) are not checked: the schema's structure is what matters here.
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  return ajv.compile(OAS_SCHEMA);
}

let production: TestApp;
let doc: OpenApiDocument;

beforeAll(async () => {
  production = await buildTestApp({ db: offlineDb() });
  doc = buildOpenApiDocument(production.app);
});

afterAll(async () => {
  await production.app.close();
});

describe('OpenAPI 3.1 meta-schema', () => {
  it('the production document is a valid OpenAPI 3.1 document', () => {
    const validate = documentValidator();
    const valid = validate(doc);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('lists the identity routes', () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/auth/sign-in', '/auth/session', '/auth/sessions/{id}']),
    );
  });

  it('every component schema compiles as JSON Schema 2020-12', () => {
    const ajv = new Ajv2020({ strict: false, validateFormats: false });
    // Components reference each other as `#/components/schemas/X`: hold them in one document.
    ajv.addSchema({ $id: 'urn:shifa:openapi', components: doc.components });
    for (const name of Object.keys(doc.components.schemas)) {
      const ref = { $ref: `urn:shifa:openapi#/components/schemas/${name}` };
      expect(() => ajv.compile(ref), name).not.toThrow();
    }
  });

  it('red: a document without info or with a bad openapi version fails', () => {
    const validate = documentValidator();
    const { info: _info, ...noInfo } = doc;
    expect(validate(noInfo)).toBe(false);
    expect(validate({ ...doc, openapi: '3.0.3' })).toBe(false);
    expect(validate({ ...doc, paths: { 'no-leading-slash': {} } })).toBe(false);
  });
});
