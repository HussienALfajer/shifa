// Shared response fixtures (packages/contracts/fixtures/responses.json) validate against the
// committed OpenAPI 3.1 document, so the TypeScript and Dart clients are tested on the same data.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

interface Fixture {
  name: string;
  schema: string;
  extraFields?: boolean;
  body: unknown;
}

const contractsDir = join(import.meta.dirname, '..', '..', 'contracts');
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const document = readJson(join(contractsDir, 'generated', 'openapi.json')) as {
  components: { schemas: Record<string, { enum?: string[] }> };
};
const fixtures = readJson(join(contractsDir, 'fixtures', 'responses.json')) as {
  valid: Fixture[];
  invalid: Fixture[];
};

// The document's components are registered as one schema; refs stay `#/components/schemas/X`.
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addVocabulary(['components']);
ajv.addSchema({ $id: 'openapi.json', components: document.components });

function validate(fixture: Fixture) {
  const validator = ajv.getSchema(`openapi.json#/components/schemas/${fixture.schema}`);
  if (!validator) throw new Error(`no schema ${fixture.schema} in openapi.json`);
  return { ok: validator(fixture.body), errors: validator.errors };
}

describe('response fixtures against openapi.json', () => {
  it.each(fixtures.valid.map((f) => [f.name, f] as const))('accepts %s', (_name, fixture) => {
    const { ok, errors } = validate(fixture);
    expect(errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it.each(fixtures.invalid.map((f) => [f.name, f] as const))('rejects %s', (_name, fixture) => {
    expect(validate(fixture).ok).toBe(false);
  });

  it('rejects a health status other than ok (const)', () => {
    expect(validate({ name: 'x', schema: 'HealthStatus', body: { status: 'degraded' } }).ok).toBe(
      false,
    );
  });

  it('has an error envelope fixture for every error code in the document', () => {
    const codes = document.components.schemas['ErrorCode']?.enum ?? [];
    expect(codes.length).toBeGreaterThan(0);
    const covered = new Set(
      fixtures.valid
        .filter((f) => f.schema === 'ErrorEnvelope')
        .map((f) => (f.body as { error: { code: string } }).error.code),
    );
    expect([...codes].filter((c) => !covered.has(c))).toEqual([]);
  });

  it('only names schemas that exist in the document', () => {
    const names = new Set(Object.keys(document.components.schemas));
    const unknown = [...fixtures.valid, ...fixtures.invalid].filter((f) => !names.has(f.schema));
    expect(unknown.map((f) => f.name)).toEqual([]);
  });
});
