// Type-level contract of the generated client (Vitest typecheck): paths, methods and bodies come
// from the committed openapi.json, so a route the API does not serve does not compile.
import { describe, expectTypeOf, it } from 'vitest';
import { type ApiClient, createApiClient, type Schemas } from '../src/index.ts';

const client: ApiClient = createApiClient({ baseUrl: 'http://localhost:3000' });

async function live() {
  const { data, error } = await client.GET('/health/live');
  return { data, error };
}

async function ready() {
  const { data, error } = await client.GET('/health/ready');
  return { data, error };
}

describe('generated TypeScript client', () => {
  it('types GET /health/live from the contract', () => {
    type Result = Awaited<ReturnType<typeof live>>;
    expectTypeOf<Result['data']>().toEqualTypeOf<Schemas['HealthStatus'] | undefined>();
    expectTypeOf<Schemas['HealthStatus']>().toEqualTypeOf<{ status: 'ok' }>();
  });

  it('types the 503 error body of GET /health/ready as the error envelope', () => {
    type Result = Awaited<ReturnType<typeof ready>>;
    expectTypeOf<Result['error']>().toEqualTypeOf<Schemas['ErrorEnvelope'] | undefined>();
  });

  it('keeps required and optional fields and string enums as in the contract', () => {
    type Body = Schemas['ErrorBody'];
    expectTypeOf<Body['message']>().toEqualTypeOf<string>();
    expectTypeOf<Body['code']>().toEqualTypeOf<Schemas['ErrorCode']>();
    expectTypeOf<Body>().toHaveProperty('details');
    expectTypeOf<{ code: Schemas['ErrorCode']; message: string }>().toExtend<Body>();
    expectTypeOf<'not_found'>().toExtend<Schemas['ErrorCode']>();
    expectTypeOf<'im_a_teapot'>().not.toExtend<Schemas['ErrorCode']>();
  });

  it('rejects a path or method the API does not serve', () => {
    const wrongPath = () =>
      // @ts-expect-error -- /health/nope is not in openapi.json
      client.GET('/health/nope');
    const wrongMethod = () =>
      // @ts-expect-error -- /health/live has no POST
      client.POST('/health/live');
    expectTypeOf(wrongPath).toBeFunction();
    expectTypeOf(wrongMethod).toBeFunction();
  });
});
