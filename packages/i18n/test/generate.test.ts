// The generator turns the source into the Flutter ARB file and the typed key union.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../scripts/generate.ts';
import { loadSources, type Sources } from '../src/index.ts';

const GENERATED = join(import.meta.dirname, '..', 'generated');

const sources: Sources = {
  ar: {
    common: {
      greeting: 'مرحبًا {name}',
      items:
        '{count, plural, zero {لا} one {واحد} two {اثنان} few {{count}} many {{count}} other {{count}}}',
      role: '{role, select, doctor {طبيب} other {موظف}}',
    },
    errors: { not_found: 'غير موجود' },
  },
};

function arb(files: Record<string, string>): Record<string, unknown> {
  const text = files['arb/app_ar.arb'];
  expect(text).toBeDefined();
  return JSON.parse(text ?? '') as Record<string, unknown>;
}

describe('generate', () => {
  it('writes exactly the ARB file and the keys file', () => {
    expect(Object.keys(generate(sources)).sort()).toEqual(['arb/app_ar.arb', 'keys.ts']);
  });

  it('the ARB is valid JSON with @@locale ar and camelCase keys per namespace', () => {
    const doc = arb(generate(sources));
    expect(doc['@@locale']).toBe('ar');
    expect(doc['commonGreeting']).toBe('مرحبًا {name}');
    expect(doc['errorsNotFound']).toBe('غير موجود');
  });

  it('keeps ICU plural and select text as written', () => {
    const doc = arb(generate(sources));
    expect(doc['commonItems']).toBe(sources['ar']?.['common']?.['items']);
    expect(doc['commonRole']).toBe(sources['ar']?.['common']?.['role']);
  });

  it('declares placeholders with types and names the source key', () => {
    const doc = arb(generate(sources));
    expect(doc['@commonGreeting']).toEqual({
      description: 'common.greeting',
      placeholders: { name: { type: 'String' } },
    });
    expect(doc['@commonItems']).toEqual({
      description: 'common.items',
      placeholders: { count: { type: 'num' } },
    });
    expect(doc['@errorsNotFound']).toEqual({ description: 'errors.not_found' });
  });

  it('the keys file has a key union per namespace', () => {
    const keys = generate(sources)['keys.ts'] ?? '';
    expect(keys).toMatch(/export type CommonKey =[^;]*'greeting'[^;]*'items'[^;]*'role'/);
    expect(keys).toMatch(/export type ErrorsKey =[^;]*'not_found'/);
    expect(keys).toMatch(/export const NAMESPACES = \['common', 'errors'\] as const;/);
  });

  it('red: two keys that map to one ARB name are refused', () => {
    const clash: Sources = { ar: { common: { not_found: 'أ', notFound: 'ب' } } };
    expect(() => generate(clash)).toThrow(/notFound/);
  });

  it('is deterministic: the committed files equal a fresh generation', () => {
    const files = generate(loadSources());
    for (const [path, text] of Object.entries(files)) {
      expect(readFileSync(join(GENERATED, path), 'utf8').replaceAll('\r\n', '\n')).toBe(text);
    }
  });
});
