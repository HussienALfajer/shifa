// Builds the OpenAPI 3.1 document from the routes Nest registered and their contracts. Named Zod
// schemas become components/schemas (Zod 4 z.toJSONSchema, draft 2020-12, which OpenAPI 3.1
// uses); operations reference them by $ref. Each operation carries its access note: x-public or
// x-permission. No @nestjs/swagger and no documentation route.
import type { INestApplication } from '@nestjs/common';
import { type Contract, ErrorEnvelope, STATUS_ERRORS, schemaId } from '@shifa/contracts';
import { z } from 'zod';
import { ContractCheck } from './contract-check.ts';
import { pathParameters, type RouteHandler } from './routes.ts';

type Json = Record<string, unknown>;

export interface OpenApiOperation {
  operationId: string;
  summary?: string;
  parameters?: Json[];
  requestBody?: Json;
  responses: Record<string, Json>;
  'x-public'?: true;
  'x-permission'?: string;
}

export type OpenApiPathItem = Partial<
  Record<'get' | 'put' | 'post' | 'delete' | 'patch', OpenApiOperation>
>;

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string };
  paths: Record<string, OpenApiPathItem>;
  components: { schemas: Record<string, Json> };
}

const REF_PREFIX = '#/components/schemas/';
const JSON_CONTENT = 'application/json';
const SUCCESS_TEXT: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No content',
};

const ref = (schema: z.ZodType): Json => {
  const id = schemaId(schema);
  if (id === undefined)
    throw new Error('contract schema without an id (the start-up check missed it)');
  return { $ref: `${REF_PREFIX}${id}` };
};

const toOpenApiPath = (path: string) => path.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}');

/** Every named schema as a component (without $schema/$id), keyed by id. */
function allComponents(): Record<string, Json> {
  const { schemas } = z.toJSONSchema(z.globalRegistry, { uri: (id) => `${REF_PREFIX}${id}` });
  return Object.fromEntries(
    Object.entries(schemas).map(([id, schema]) => [
      id,
      Object.fromEntries(
        Object.entries(schema as Json).filter(([key]) => key !== '$schema' && key !== '$id'),
      ),
    ]),
  );
}

function parameters(contract: Contract, components: Record<string, Json>): Json[] {
  const out: Json[] = [];
  const add = (where: 'path' | 'query', schema: z.ZodType | undefined, order?: string[]) => {
    if (!schema) return;
    const component = components[schemaId(schema) ?? ''] ?? {};
    const properties = (component['properties'] ?? {}) as Record<string, Json>;
    const required = new Set((component['required'] ?? []) as string[]);
    const names = order ?? Object.keys(properties).sort();
    for (const name of names) {
      out.push({
        in: where,
        name,
        required: where === 'path' || required.has(name),
        schema: properties[name] ?? {},
      });
    }
  };
  add('path', contract.request?.params, pathParameters(contract.path));
  add('query', contract.request?.query);
  return out;
}

function response(status: number, schema: z.ZodType | null): Json {
  const description = SUCCESS_TEXT[status] ?? STATUS_ERRORS[status]?.message ?? 'Response';
  return schema
    ? { description, content: { [JSON_CONTENT]: { schema: ref(schema) } } }
    : { description };
}

function operation(
  route: RouteHandler,
  contract: Contract,
  components: Record<string, Json>,
): OpenApiOperation {
  const responses: Record<string, Json> = {};
  for (const [status, schema] of Object.entries(contract.responses)) {
    responses[status] = response(Number(status), schema);
  }
  const fallback = (status: number) => {
    responses[String(status)] ??= response(status, ErrorEnvelope);
  };
  if (contract.request?.params || contract.request?.query || contract.request?.body) fallback(400);
  if (!route.public) {
    fallback(401);
    fallback(403);
  }
  const params = parameters(contract, components);
  const body = contract.request?.body;
  return {
    operationId: contract.operationId,
    ...(contract.summary ? { summary: contract.summary } : {}),
    ...(params.length > 0 ? { parameters: params } : {}),
    ...(body
      ? { requestBody: { required: true, content: { [JSON_CONTENT]: { schema: ref(body) } } } }
      : {}),
    responses,
    ...(route.public ? { 'x-public': true as const } : { 'x-permission': route.permission ?? '' }),
  };
}

/** Ids reachable by $ref from `roots`, following refs inside components. */
function reachable(roots: unknown, components: Record<string, Json>): Set<string> {
  const seen = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string' && value.startsWith(REF_PREFIX)) {
          const id = value.slice(REF_PREFIX.length);
          if (!seen.has(id)) {
            seen.add(id);
            visit(components[id]);
          }
        } else {
          visit(value);
        }
      }
    }
  };
  visit(roots);
  return seen;
}

/** The document for every route of `app` (after init: the start-up check has passed). */
export function buildOpenApiDocument(app: INestApplication): OpenApiDocument {
  const components = allComponents();
  const paths: Record<string, OpenApiPathItem> = {};
  for (const route of app.get(ContractCheck).routes()) {
    const contract = route.contract;
    if (!contract) continue;
    const path = toOpenApiPath(contract.path);
    const method = contract.method.toLowerCase() as keyof OpenApiPathItem;
    paths[path] = { ...paths[path], [method]: operation(route, contract, components) };
  }
  const used = reachable(paths, components);
  return {
    openapi: '3.1.0',
    info: { title: 'Shifa API', version: '0.0.0' },
    paths,
    components: {
      schemas: Object.fromEntries(Object.entries(components).filter(([id]) => used.has(id))),
    },
  };
}

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

/** Stable text: keys sorted at every level, two-space indent, LF, trailing newline. */
export function serializeDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(sortKeys(document), null, 2)}\n`;
}
