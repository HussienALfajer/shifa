// The OpenAPI 3.1 document built from the registered routes and their contracts: every route is
// present, every schema is a $ref to a named component, the access note matches the reviewed
// route matrix, and the serialised output is byte-stable.
import { anonymousSchemas } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildOpenApiDocument,
  type OpenApiDocument,
  serializeDocument,
} from '../../src/platform/contract/openapi.ts';
import { GatedProbeController, TEST_ENTITLEMENTS, TEST_FLAGS } from '../access/gated-probe.ts';
import { ProbeController, TEST_PERMISSIONS } from '../access/probe.ts';
import { EXPECTED_MATRIX, TEST_ONLY_ROUTES } from '../architecture/route-matrix.expected.ts';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';
import { ContractProbeController } from './probe.ts';

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

interface Operation {
  operationId?: string;
  parameters?: { name: string; in: string; required?: boolean; schema: unknown }[];
  requestBody?: { required?: boolean; content: Record<string, { schema: unknown }> };
  responses: Record<
    string,
    { description?: string; content?: Record<string, { schema: unknown }> }
  >;
  'x-public'?: boolean;
  'x-permission'?: string;
  'x-signed-in'?: boolean;
  'x-platform-admin'?: boolean;
  'x-before-mfa'?: boolean;
}

function operations(doc: OpenApiDocument): [string, Operation][] {
  const out: [string, Operation][] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const op = (item as Record<string, Operation | undefined>)[method];
      if (op) out.push([`${method.toUpperCase()} ${path}`, op]);
    }
  }
  return out;
}

/** Every `$ref` value anywhere in the document. */
function refs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) for (const v of node) refs(v, found);
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') found.push(value);
      else refs(value, found);
    }
  }
  return found;
}

const toOpenApiPath = (route: string) => route.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}');

let probes: TestApp;
let production: TestApp;
let doc: OpenApiDocument;

beforeAll(async () => {
  probes = await buildTestApp({
    db: offlineDb(),
    controllers: [ProbeController, ContractProbeController, GatedProbeController],
    permissions: TEST_PERMISSIONS,
    entitlements: TEST_ENTITLEMENTS,
    flags: TEST_FLAGS,
  });
  production = await buildTestApp({ db: offlineDb() });
  doc = buildOpenApiDocument(probes.app);
});

afterAll(async () => {
  await probes.app.close();
  await production.app.close();
});

describe('OpenAPI document', () => {
  it('is an OpenAPI 3.1 document with info, paths and components', () => {
    expect(doc.openapi).toBe('3.1.0');
    const anyString: unknown = expect.any(String);
    expect(doc.info).toMatchObject({ title: anyString, version: anyString });
    expect(Object.keys(doc.components.schemas).length).toBeGreaterThan(0);
  });

  it('lists every registered route exactly once', () => {
    const documented = operations(doc)
      .map(([route]) => route)
      .sort();
    const registered = probes.routes
      .map((r) => {
        const [method, url] = r.split(' ') as [string, string];
        return `${method} ${toOpenApiPath(url)}`;
      })
      .sort();
    expect(documented).toEqual(registered);
  });

  it('every operation has a unique operationId and described responses', () => {
    const ids = operations(doc).map(([, op]) => op.operationId);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, op] of operations(doc)) {
      expect(Object.keys(op.responses).length).toBeGreaterThan(0);
      for (const response of Object.values(op.responses)) {
        expect(typeof response.description).toBe('string');
      }
    }
  });

  it('request and response bodies are $refs to named components', () => {
    for (const [route, op] of operations(doc)) {
      const bodies = [
        ...Object.values(op.responses).flatMap((r) => Object.values(r.content ?? {})),
        ...Object.values(op.requestBody?.content ?? {}),
      ];
      for (const body of bodies) {
        expect(Object.keys(body.schema as object), route).toEqual(['$ref']);
      }
    }
  });

  it('path and query parameters come from the contract, typed, with required flags', () => {
    const op = doc.paths['/__contract/items/{id}']?.post as Operation;
    const stringSchema: unknown = expect.objectContaining({ type: 'string' });
    const integerSchema: unknown = expect.objectContaining({ type: 'integer' });
    expect(op.parameters).toEqual([
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: stringSchema,
      },
      {
        in: 'query',
        name: 'kind',
        required: false,
        schema: { $ref: '#/components/schemas/ProbeKind' },
      },
      {
        in: 'query',
        name: 'limit',
        required: true,
        schema: integerSchema,
      },
    ]);
    expect(op.requestBody).toEqual({
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ProbeItemInput' } } },
    });
    expect(op.responses['400']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/ErrorEnvelope',
    });
  });

  it('every $ref resolves to a component, and no anonymous object or enum appears', () => {
    const names = new Set(Object.keys(doc.components.schemas));
    for (const ref of refs(doc)) {
      expect(ref.startsWith('#/components/schemas/'), ref).toBe(true);
      expect(names.has(ref.slice('#/components/schemas/'.length)), ref).toBe(true);
    }
    expect(anonymousSchemas(doc)).toEqual([]);
  });

  it('components hold only schemas reachable from the paths', () => {
    const reachable = new Set(refs(doc).map((r) => r.slice('#/components/schemas/'.length)));
    expect(Object.keys(doc.components.schemas).sort()).toEqual([...reachable].sort());
  });

  it('the access note on each route matches the route permission matrix', () => {
    // Test-only routes are never in the document (test-route.test.ts).
    const matrixRoutes = Object.keys(EXPECTED_MATRIX).filter((r) => !TEST_ONLY_ROUTES.has(r));
    for (const route of TEST_ONLY_ROUTES) {
      const [, url] = route.split(' ') as [string, string];
      expect(doc.paths[toOpenApiPath(url)], route).toBeUndefined();
    }
    for (const route of matrixRoutes) {
      const [method, url] = route.split(' ') as [string, string];
      const op = (doc.paths[toOpenApiPath(url)] as Record<string, Operation> | undefined)?.[
        method.toLowerCase()
      ];
      expect(op, route).toBeDefined();
      const row = EXPECTED_MATRIX[route];
      const isPublic = row?.anonymous === 200;
      // Signed-in routes: 401 for anonymous, 200 for every role.
      // A-02-05: ending support from the support tab is @SignedIn, and refuses every session
      // that is not a support session (the matrix shows 403 for each role).
      const isSignedIn =
        route === 'POST /auth/support/end' ||
        (!isPublic &&
          row !== undefined &&
          Object.entries(row).every(([c, s]) => c === 'anonymous' || s === 200));
      // Super-admin routes: 401 for anonymous, 200 for platform_admin only.
      const isPlatformAdmin =
        !isPublic &&
        row !== undefined &&
        Object.entries(row).every(([c, s]) =>
          c === 'anonymous' ? s === 401 : c === 'platform_admin' ? s === 200 : s === 403,
        );
      expect(op?.['x-public'] === true, route).toBe(isPublic);
      expect(op?.['x-signed-in'] === true, route).toBe(isSignedIn);
      expect(op?.['x-platform-admin'] === true, route).toBe(isPlatformAdmin);
      expect(typeof op?.['x-permission'] === 'string', route).toBe(
        !isPublic && !isSignedIn && !isPlatformAdmin,
      );
    }
    const sensitive = doc.paths['/__probe/sensitive']?.get as Operation;
    expect(sensitive['x-permission']).toBe('test.sensitive');
    expect(sensitive.responses['401']).toBeDefined();
    expect(sensitive.responses['403']).toBeDefined();
  });

  it('serialises byte-stably with sorted keys and a trailing newline', async () => {
    const again = await buildTestApp({ db: offlineDb() });
    try {
      const first = serializeDocument(buildOpenApiDocument(production.app));
      const second = serializeDocument(buildOpenApiDocument(again.app));
      expect(second).toBe(first);
      expect(first.endsWith('}\n')).toBe(true);
      const top = Object.keys(JSON.parse(first) as object);
      expect(top).toEqual([...top].sort());
    } finally {
      await again.app.close();
    }
  });

  it('the production document lists only production routes', () => {
    const prod = buildOpenApiDocument(production.app);
    expect(Object.keys(prod.paths).sort()).toEqual([
      '/auth/mfa',
      '/auth/mfa/challenge',
      '/auth/mfa/enrol/confirm',
      '/auth/mfa/enrol/start',
      '/auth/mfa/re-enrol/confirm',
      '/auth/mfa/re-enrol/start',
      '/auth/mfa/recovery-codes',
      '/auth/password',
      '/auth/session',
      '/auth/sessions',
      '/auth/sessions/end-others',
      '/auth/sessions/{id}',
      '/auth/setup-link/consume',
      '/auth/setup-link/view',
      '/auth/sign-in',
      '/auth/sign-out',
      '/auth/support/end',
      '/auth/support/session',
      '/branches',
      '/branches/{id}',
      '/branches/{id}/archive',
      '/branches/{id}/archive-preview',
      '/branches/{id}/restore',
      '/clinic/capabilities',
      '/clinic/places',
      '/clinic/settings',
      '/clinic/subscription',
      '/clinic/support-grants',
      '/clinic/support-grants/{id}/end',
      '/health/live',
      '/health/ready',
      '/invitations/accept',
      '/invitations/decline',
      '/invitations/view',
      '/me',
      '/me/announcements',
      '/me/announcements/{id}/dismiss',
      '/me/clinics',
      '/me/switch',
      '/patients',
      '/patients/count',
      '/patients/{id}',
      '/patients/{id}/archive',
      '/patients/{id}/restore',
      '/platform/announcements',
      '/platform/announcements/{id}',
      '/platform/announcements/{id}/end',
      '/platform/areas/{id}',
      '/platform/areas/{id}/archive',
      '/platform/areas/{id}/restore',
      '/platform/cities',
      '/platform/cities/{id}',
      '/platform/cities/{id}/archive',
      '/platform/cities/{id}/areas',
      '/platform/cities/{id}/restore',
      '/platform/clinics',
      '/platform/clinics/{id}',
      '/platform/clinics/{id}/entitlements',
      '/platform/clinics/{id}/overrides/{key}',
      '/platform/clinics/{id}/overrides/{key}/history',
      '/platform/clinics/{id}/owner',
      '/platform/clinics/{id}/owner/end-sessions',
      '/platform/clinics/{id}/owner/reset-mfa',
      '/platform/clinics/{id}/owner/setup-link',
      '/platform/clinics/{id}/settings',
      '/platform/clinics/{id}/settings/{key}/lock',
      '/platform/clinics/{id}/support-grants',
      '/platform/clinics/{id}/type-preview',
      '/platform/clinics/{id}/usage',
      '/platform/flags',
      '/platform/flags/{key}',
      '/platform/support-grants/{id}/end',
      '/platform/support-grants/{id}/handoff',
      '/team/members',
      '/team/members/{id}',
      '/team/members/{id}/deactivate',
      '/team/members/{id}/phone',
      '/team/members/{id}/reactivate',
      '/team/members/{id}/reset-mfa',
      '/team/members/{id}/setup-link',
      '/team/permissions',
    ]);
    expect(Object.keys(prod.components.schemas).some((n) => n.startsWith('Probe'))).toBe(false);
  });
});
