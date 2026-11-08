// Review 0.2-07b: client-chosen keys never reach 400 details or the log; handlers cannot read
// input their contract does not validate; request schemas are documented in their input shape;
// ambiguous schemas stop the generator instead of producing a wrong document.
import { Body, Controller, Get, HttpCode, Post, Query, Req, Version } from '@nestjs/common';
import { defineContract } from '@shifa/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Public } from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildOpenApiDocument } from '../../src/platform/contract/openapi.ts';
import { buildTestApp, offlineDb, TestAnything, type TestApp } from '../support.ts';

const MARKER = 'synthetic-key-4410';

const HardeningScores = z
  .object({
    scores: z.record(z.string(), z.number()),
    items: z.array(z.object({ n: z.number() }).meta({ id: 'HardeningItem' })).optional(),
  })
  .meta({ id: 'HardeningScores' });
const HardeningOpen = z
  .object({ a: z.string() })
  .catchall(z.number())
  .meta({ id: 'HardeningOpen' });
const HardeningPage = z
  .object({
    limit: z.coerce.number().int().default(20),
    trimmed: z
      .string()
      .transform((s) => s.trim())
      .optional(),
  })
  .meta({ id: 'HardeningPage' });
const HardeningOut = z.object({ ok: z.boolean() }).meta({ id: 'HardeningOut' });

const scores = defineContract({
  operationId: 'hardeningScores',
  method: 'POST',
  path: '/__hardening/scores',
  request: { body: HardeningScores },
  responses: { 200: HardeningOut },
});
const open = defineContract({
  operationId: 'hardeningOpen',
  method: 'POST',
  path: '/__hardening/open',
  request: { body: HardeningOpen },
  responses: { 200: HardeningOut },
});
const page = defineContract({
  operationId: 'hardeningPage',
  method: 'GET',
  path: '/__hardening/page',
  request: { query: HardeningPage },
  responses: { 200: HardeningOut },
});

@Controller('__hardening')
class HardeningController {
  @Public()
  @Contract(scores)
  @HttpCode(200)
  @Post('scores')
  scores(): { ok: boolean } {
    return { ok: true };
  }

  @Public()
  @Contract(open)
  @HttpCode(200)
  @Post('open')
  open(): { ok: boolean } {
    return { ok: true };
  }

  @Public()
  @Contract(page)
  @Get('page')
  page(@Query() query: z.output<typeof HardeningPage>): { ok: boolean } {
    return { ok: query.limit === 20 };
  }
}

const bare = (operationId: string, method: 'GET' | 'POST', path: string) =>
  defineContract({
    operationId,
    method,
    path,
    responses: { [method === 'POST' ? 201 : 200]: TestAnything },
  });

@Controller('__bypass')
class BypassController {
  @Public()
  @Contract(bare('bypassBody', 'POST', '/__bypass/body'))
  @Post('body')
  body(@Body() body: unknown): unknown {
    return body;
  }

  @Public()
  @Contract(bare('bypassQuery', 'GET', '/__bypass/query'))
  @Get('query')
  query(@Query() query: unknown): unknown {
    return query;
  }

  @Public()
  @Contract(bare('bypassRequest', 'GET', '/__bypass/request'))
  @Get('request')
  request(@Req() req: unknown): string {
    return typeof req;
  }

  @Public()
  @Contract(bare('bypassVersion', 'GET', '/__bypass/versioned'))
  @Version('2')
  @Get('versioned')
  versioned(): string {
    return 'never';
  }

  @Public()
  @Contract(
    defineContract({
      ...bare('bypassUnion', 'GET', '/__bypass/union'),
      request: {
        query: z
          .union([z.object({ a: z.string() }), z.object({ b: z.string() })])
          .meta({ id: 'BypassUnion' }),
      },
    }),
  )
  @Get('union')
  union(@Query() query: unknown): unknown {
    return query;
  }
}

const Dup1 = z.object({ a: z.string() }).meta({ id: 'HardeningDup' });
const Dup2 = z.object({ b: z.string() }).meta({ id: 'HardeningDup' });
const HardeningShared = z.object({ n: z.number().default(1) }).meta({ id: 'HardeningShared' });

@Controller('__ambiguous')
class DuplicateIdController {
  @Public()
  @Contract(
    defineContract({ ...bare('ambiguousA', 'GET', '/__ambiguous/a'), responses: { 200: Dup1 } }),
  )
  @Get('a')
  a(): string {
    return 'a';
  }

  @Public()
  @Contract(
    defineContract({ ...bare('ambiguousB', 'GET', '/__ambiguous/b'), responses: { 200: Dup2 } }),
  )
  @Get('b')
  b(): string {
    return 'b';
  }
}

@Controller('__shared')
class SharedIoController {
  @Public()
  @Contract(
    defineContract({
      operationId: 'sharedBoth',
      method: 'POST',
      path: '/__shared',
      request: { body: HardeningShared },
      responses: { 201: HardeningShared },
    }),
  )
  @Post()
  both(@Body() body: unknown): unknown {
    return body;
  }
}

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

async function app(controllers: NonNullable<Parameters<typeof buildTestApp>[0]['controllers']>) {
  current = await buildTestApp({ db: offlineDb(), controllers });
  return current;
}

async function post(t: TestApp, url: string, body: unknown) {
  return t.app.inject({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
}

describe('400 details never carry client-chosen keys', () => {
  it('a record key is reported as *', async () => {
    const t = await app([HardeningController]);
    const res = await post(t, '/__hardening/scores', { scores: { [MARKER]: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { details: [{ path: 'body.scores.*', code: 'invalid_type' }] },
    });
    expect(res.body).not.toContain(MARKER);
    expect(t.logs.text()).not.toContain(MARKER);
  });

  it('a catchall key is reported as *', async () => {
    const t = await app([HardeningController]);
    const res = await post(t, '/__hardening/open', { a: 'x', [MARKER]: 'y' });
    expect(res.json()).toMatchObject({
      error: { details: [{ path: 'body.*', code: 'invalid_type' }] },
    });
    expect(res.body).not.toContain(MARKER);
    expect(t.logs.text()).not.toContain(MARKER);
  });

  it('declared keys and array indexes are kept', async () => {
    const t = await app([HardeningController]);
    const res = await post(t, '/__hardening/scores', { scores: {}, items: [{ n: 1 }, { n: 'x' }] });
    expect(res.json()).toMatchObject({
      error: { details: [{ path: 'body.items.1.n', code: 'invalid_type' }] },
    });
  });

  it('a default applies before the handler', async () => {
    const t = await app([HardeningController]);
    const res = await t.app.inject({ method: 'GET', url: '/__hardening/page' });
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('start-up check: input the contract does not validate', () => {
  it('refuses @Body/@Query without a schema, @Req, @Version and a non-object query', async () => {
    const start = app([BypassController]);
    await expect(start).rejects.toThrow(/BypassController\.body: @BODY used without request\.body/);
    await expect(start).rejects.toThrow(
      /BypassController\.query: @QUERY used without request\.query/,
    );
    await expect(start).rejects.toThrow(
      /BypassController\.request: REQUEST parameter bypasses the contract/,
    );
    await expect(start).rejects.toThrow(
      /BypassController\.versioned: @Version\(\) is not supported/,
    );
    await expect(start).rejects.toThrow(
      /BypassController\.union: request query must be a z\.object/,
    );
  });
});

describe('OpenAPI rendering', () => {
  it('request schemas use their input shape: a defaulted query field is optional', async () => {
    const t = await app([HardeningController]);
    const doc = buildOpenApiDocument(t.app);
    const op = doc.paths['/__hardening/page']?.get;
    expect(op).toBeDefined();
    const limit = op?.parameters?.find((p) => p['name'] === 'limit');
    expect(limit?.['required']).toBe(false);
    expect(doc.components.schemas['HardeningScores']?.['additionalProperties']).toBeUndefined();
  });

  it('response objects stay open for fields added later', async () => {
    const t = await app([HardeningController]);
    const doc = buildOpenApiDocument(t.app);
    expect(doc.components.schemas['HardeningOut']).not.toHaveProperty('additionalProperties');
  });

  it('two different schemas with one id stop the generator', async () => {
    const t = await app([DuplicateIdController]);
    expect(() => buildOpenApiDocument(t.app)).toThrow(
      /two different schemas use the id HardeningDup/,
    );
  });

  it('a schema that renders differently as request and response stops the generator', async () => {
    const t = await app([SharedIoController]);
    expect(() => buildOpenApiDocument(t.app)).toThrow(
      /schema HardeningShared differs as input and output/,
    );
  });
});
