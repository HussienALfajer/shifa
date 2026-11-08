// Walks Zod 4 schema trees through their definitions: the named schemas a contract reaches
// (for the OpenAPI document) and the declared part of an issue path (for 400 details).
import { schemaId } from '@shifa/contracts';
import type { z } from 'zod';

type Def = Record<string, unknown> & { type: string };

const isSchema = (value: unknown): value is z.ZodType =>
  typeof value === 'object' && value !== null && '_zod' in value;

const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

/** Direct child schemas of `schema`, whatever its kind. */
function children(schema: z.ZodType): z.ZodType[] {
  const def = defOf(schema);
  const out: z.ZodType[] = [];
  for (const [key, value] of Object.entries(def)) {
    if (isSchema(value)) out.push(value);
    else if (Array.isArray(value)) out.push(...value.filter(isSchema));
    else if (key === 'shape' && value && typeof value === 'object') {
      out.push(...Object.values(value).filter(isSchema));
    }
  }
  if (def.type === 'lazy' && typeof def['getter'] === 'function') {
    out.push((def['getter'] as () => z.ZodType)());
  }
  return out;
}

/**
 * Every named schema reachable from `roots`, by id. Throws when two different schemas share an
 * id: the document would silently keep one of them.
 */
export function namedSchemas(roots: readonly z.ZodType[]): Map<string, z.ZodType> {
  const named = new Map<string, z.ZodType>();
  const seen = new Set<z.ZodType>();
  const visit = (schema: z.ZodType): void => {
    if (seen.has(schema)) return;
    seen.add(schema);
    const id = schemaId(schema);
    if (id !== undefined) {
      const other = named.get(id);
      if (other !== undefined && other !== schema) {
        throw new Error(`two different schemas use the id ${id}; rename one`);
      }
      named.set(id, schema);
    }
    for (const child of children(schema)) visit(child);
  };
  for (const root of roots) visit(root);
  return named;
}

const WRAPPERS = new Set([
  'optional',
  'nullable',
  'default',
  'prefault',
  'nonoptional',
  'readonly',
  'catch',
  'promise',
]);

/** The schema that decides the shape: wrappers, pipes (input side) and lazies removed. */
function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (let depth = 0; depth < 32; depth += 1) {
    const def = defOf(current);
    if (WRAPPERS.has(def.type) && isSchema(def['innerType'])) current = def['innerType'];
    else if (def.type === 'pipe' && isSchema(def['in'])) current = def['in'];
    else if (def.type === 'lazy' && typeof def['getter'] === 'function') {
      current = (def['getter'] as () => z.ZodType)();
    } else break;
  }
  return current;
}

function step(schema: z.ZodType, segment: PropertyKey): z.ZodType | undefined {
  const node = unwrap(schema);
  const def = defOf(node);
  if (def.type === 'object' && typeof segment === 'string') {
    const shape = def['shape'] as Record<string, unknown>;
    return Object.hasOwn(shape, segment) && isSchema(shape[segment]) ? shape[segment] : undefined;
  }
  if (def.type === 'array' && typeof segment === 'number' && isSchema(def['element'])) {
    return def['element'];
  }
  if (def.type === 'tuple' && typeof segment === 'number') {
    const items = def['items'] as unknown[];
    const item = items[segment] ?? def['rest'];
    return isSchema(item) ? item : undefined;
  }
  if (def.type === 'union' || def.type === 'intersection') {
    for (const option of children(node)) {
      const found = step(option, segment);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * The issue path with every segment the schema does not declare replaced by `*`: keys of a
 * record, a catchall or an unknown property are chosen by the client and may be patient data.
 */
export function declaredPath(schema: z.ZodType, path: readonly PropertyKey[]): string[] {
  const out: string[] = [];
  let current: z.ZodType | undefined = schema;
  for (const segment of path) {
    const next: z.ZodType | undefined = current ? step(current, segment) : undefined;
    out.push(next ? String(segment) : '*');
    current = next;
  }
  return out;
}
