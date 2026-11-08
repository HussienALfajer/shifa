// ADR-0013 "lint on unnamed schemas": every exported Zod schema carries a unique PascalCase id,
// and no anonymous object or enum reaches the committed OpenAPI document.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as contracts from '../src/index.ts';
import { anonymousSchemas, unnamedSchemaExports } from '../src/lint.ts';

const DOCUMENT = join(import.meta.dirname, '..', 'generated', 'openapi.json');

describe('named schemas', () => {
  it('every exported schema of the package has a unique PascalCase id', () => {
    expect(unnamedSchemaExports(contracts)).toEqual([]);
  });

  it('red: an unnamed, a camelCase and a duplicated id are each reported by export name', () => {
    const Named = z.string().meta({ id: 'LintNamed' });
    const fake = {
      Named,
      Bare: z.object({ a: z.string() }),
      lower: z.string().meta({ id: 'lintLower' }),
      Twin: z.number().meta({ id: 'LintNamed' }),
      notASchema: 42,
    };
    expect(unnamedSchemaExports(fake)).toEqual([
      'Bare: no id',
      'Twin: id LintNamed is already used by Named',
      'lower: id lintLower is not PascalCase',
    ]);
  });
});

describe('generated OpenAPI document', () => {
  it('has no anonymous object or enum anywhere', () => {
    const document = JSON.parse(readFileSync(DOCUMENT, 'utf8')) as unknown;
    expect(anonymousSchemas(document)).toEqual([]);
  });

  it('red: inline objects and enums are reported with their JSON pointer', () => {
    const document = {
      openapi: '3.1.0',
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: { 'application/json': { schema: { type: 'object', properties: {} } } },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Fine: { type: 'string', enum: ['a', 'b'] },
          Outer: {
            type: 'object',
            properties: {
              inner: { type: 'object', properties: { a: { type: 'string' } } },
              kind: { anyOf: [{ type: 'string', enum: ['x'] }, { type: 'null' }] },
              ref: { $ref: '#/components/schemas/Fine' },
            },
          },
        },
      },
    };
    expect(anonymousSchemas(document)).toEqual([
      '/components/schemas/Outer/properties/inner',
      '/components/schemas/Outer/properties/kind/anyOf/0',
      '/paths/~1x/get/responses/200/content/application~1json/schema',
    ]);
  });
});
