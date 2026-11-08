// The ADR-0013 lint on unnamed schemas, used by the package test and by the API's OpenAPI
// generator: exported schemas need unique PascalCase ids, and the generated document may hold
// objects and enums only as named components.
import { z } from 'zod';

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

/** The `.meta({ id })` of a schema, if any. */
export function schemaId(schema: z.ZodType): string | undefined {
  const id = z.globalRegistry.get(schema)?.id;
  return typeof id === 'string' ? id : undefined;
}

function isSchema(value: unknown): value is z.ZodType {
  return typeof value === 'object' && value !== null && '_zod' in value;
}

/** One line per exported schema without an id, with a non-PascalCase id, or a reused id. */
export function unnamedSchemaExports(exports: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string>();
  for (const [name, value] of Object.entries(exports)) {
    if (!isSchema(value)) continue;
    const id = schemaId(value);
    if (id === undefined) {
      problems.push(`${name}: no id`);
      continue;
    }
    if (!PASCAL_CASE.test(id)) problems.push(`${name}: id ${id} is not PascalCase`);
    const owner = owners.get(id);
    if (owner !== undefined) problems.push(`${name}: id ${id} is already used by ${owner}`);
    else owners.set(id, name);
  }
  return problems.sort();
}

const escape = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

function isAnonymousShape(node: Record<string, unknown>): boolean {
  const type = node['type'];
  const types = Array.isArray(type) ? type : [type];
  return types.includes('object') || 'properties' in node || Array.isArray(node['enum']);
}

function walk(node: unknown, pointer: string, rootAllowed: boolean, found: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      walk(item, `${pointer}/${String(i)}`, false, found);
    });
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const record = node as Record<string, unknown>;
  if (!rootAllowed && isAnonymousShape(record)) {
    found.push(pointer);
    return;
  }
  for (const [key, value] of Object.entries(record)) {
    walk(value, `${pointer}/${escape(key)}`, false, found);
  }
}

/** JSON pointers of every inline object or enum in an OpenAPI document. */
export function anonymousSchemas(document: unknown): string[] {
  const found: string[] = [];
  const doc = (document ?? {}) as {
    paths?: unknown;
    components?: { schemas?: Record<string, unknown> };
  };
  for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
    walk(schema, `/components/schemas/${escape(name)}`, true, found);
  }
  walk(doc.paths, '/paths', false, found);
  return found.sort();
}
