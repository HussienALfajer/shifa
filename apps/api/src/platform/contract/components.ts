// components/schemas for the OpenAPI document: every named schema the contracts reach, rendered
// with Zod 4 z.toJSONSchema (draft 2020-12, which OpenAPI 3.1 uses). Request schemas render in
// input mode (defaults are optional for the caller, transforms show their input), responses in
// output mode without `additionalProperties: false`, so clients tolerate fields added later.
import type { Contract } from '@shifa/contracts';
import { z } from 'zod';
import { namedSchemas } from './schema-walk.ts';

type Json = Record<string, unknown>;
type Io = 'input' | 'output';

export const REF_PREFIX = '#/components/schemas/';
const DEFS_PREFIX = '#/$defs/';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Json)[key])]),
    );
  }
  return value;
}

/** Same JSON at every key order. */
export const stableJson = (value: unknown): string => JSON.stringify(sortKeys(value));

/** `$defs` refs → component refs; in output mode, drops the closed-object marker. */
function rewrite(node: unknown, io: Io): unknown {
  if (Array.isArray(node)) return node.map((item) => rewrite(item, io));
  if (!node || typeof node !== 'object') return node;
  const out: Json = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string' && value.startsWith(DEFS_PREFIX)) {
      out[key] = `${REF_PREFIX}${value.slice(DEFS_PREFIX.length)}`;
    } else if (io === 'output' && key === 'additionalProperties' && value === false) {
      continue;
    } else {
      out[key] = rewrite(value, io);
    }
  }
  return out;
}

function requestRoots(contract: Contract): z.ZodType[] {
  const request = contract.request ?? {};
  return [request.params, request.query, request.body].filter((s) => s !== undefined);
}

function responseRoots(contract: Contract): z.ZodType[] {
  return Object.values(contract.responses).filter((s): s is z.ZodType => s !== null);
}

/**
 * Components for `contracts`, keyed by id. Throws when two schemas share an id, when a reused or
 * recursive schema has no id, or when a schema renders differently as request and as response
 * (a default, transform or optional key): split it into `<Name>Input` and `<Name>`.
 */
export function contractComponents(contracts: readonly Contract[]): Record<string, Json> {
  const roots = contracts.flatMap((c) => [...requestRoots(c), ...responseRoots(c)]);
  const named = namedSchemas(roots);
  const components = new Map<string, { json: Json; io: Io }>();
  const add = (schema: z.ZodType, io: Io) => {
    const rendered = z.toJSONSchema(schema, { io, target: 'draft-2020-12' }) as Json;
    const defs = (rendered['$defs'] ?? {}) as Record<string, Json>;
    for (const [id, def] of Object.entries(defs)) {
      if (!named.has(id)) {
        throw new Error(`an unnamed schema is reused or recursive (${id}); give it .meta({ id })`);
      }
      const json = rewrite(def, io) as Json;
      const existing = components.get(id);
      if (existing && stableJson(existing.json) !== stableJson(json)) {
        throw new Error(
          `schema ${id} differs as ${existing.io} and ${io}; split it into ${id}Input and ${id}`,
        );
      }
      components.set(id, { json, io });
    }
  };
  for (const contract of contracts) {
    for (const schema of requestRoots(contract)) add(schema, 'input');
    for (const schema of responseRoots(contract)) add(schema, 'output');
  }
  return Object.fromEntries([...components].map(([id, { json }]) => [id, json]));
}
