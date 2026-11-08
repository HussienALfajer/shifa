// Fail-closed at start: a route handler without @Contract, or whose contract names another method
// or path than the route Nest registered, or uses unnamed schemas, stops the app.
import { Controller, Get, Post } from '@nestjs/common';
import { defineContract } from '@shifa/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Public } from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildTestApp, offlineDb, type TestApp, testContract } from '../support.ts';

@Controller('__missing')
class MissingController {
  @Public()
  @Contract(testContract('GET', '/__missing/ok'))
  @Get('ok')
  ok(): string {
    return 'ok';
  }

  @Public()
  @Get('bare')
  bare(): string {
    return 'never';
  }

  @Public()
  @Post('also-bare')
  alsoBare(): string {
    return 'never';
  }

  /** Not a route handler: needs no contract. */
  helper(): string {
    return 'helper';
  }
}

@Controller('__mismatch')
class MismatchController {
  @Public()
  @Contract(testContract('GET', '/__mismatch/elsewhere'))
  @Get('here')
  wrongPath(): string {
    return 'never';
  }

  @Public()
  @Contract(testContract('POST', '/__mismatch/method'))
  @Get('method')
  wrongMethod(): string {
    return 'never';
  }

  @Public()
  @Contract(testContract('GET', '/__mismatch/items/:id'))
  @Get('items/:itemId')
  wrongParam(): string {
    return 'never';
  }
}

const unnamed = defineContract({
  operationId: 'testUnnamed',
  method: 'POST',
  path: '/__unnamed',
  request: { body: z.object({ name: z.string() }) },
  responses: { 200: z.object({ ok: z.boolean() }) },
});

@Controller('__unnamed')
class UnnamedController {
  @Public()
  @Contract(unnamed)
  @Post()
  handler(): string {
    return 'never';
  }
}

@Controller('__twins')
class TwinController {
  @Public()
  @Contract(defineContract({ ...testContract('GET', '/__twins/a'), operationId: 'testTwin' }))
  @Get('a')
  first(): string {
    return 'never';
  }

  @Public()
  @Contract(defineContract({ ...testContract('GET', '/__twins/b'), operationId: 'testTwin' }))
  @Get('b')
  second(): string {
    return 'never';
  }
}

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

describe('contract check at start', () => {
  it('refuses to start and names every handler without @Contract', async () => {
    const start = buildTestApp({ db: offlineDb(), controllers: [MissingController] });
    await expect(start).rejects.toThrow(/MissingController\.bare: no @Contract/);
    await expect(start).rejects.toThrow(/MissingController\.alsoBare: no @Contract/);
    await expect(start).rejects.not.toThrow(/MissingController\.(ok|helper)/);
  });

  it('refuses to start when the contract path or method differs from the route', async () => {
    const start = buildTestApp({ db: offlineDb(), controllers: [MismatchController] });
    await expect(start).rejects.toThrow(
      /MismatchController\.wrongPath: contract says GET \/__mismatch\/elsewhere, route is GET \/__mismatch\/here/,
    );
    await expect(start).rejects.toThrow(
      /MismatchController\.wrongMethod: contract says POST \/__mismatch\/method, route is GET \/__mismatch\/method/,
    );
    await expect(start).rejects.toThrow(/MismatchController\.wrongParam: contract says/);
  });

  it('refuses to start when a contract uses an unnamed schema', async () => {
    const start = buildTestApp({ db: offlineDb(), controllers: [UnnamedController] });
    await expect(start).rejects.toThrow(/UnnamedController\.handler: request body has no id/);
    await expect(start).rejects.toThrow(/UnnamedController\.handler: response 200 has no id/);
  });

  it('refuses to start when two contracts share an operationId', async () => {
    const start = buildTestApp({ db: offlineDb(), controllers: [TwinController] });
    await expect(start).rejects.toThrow(/operationId testTwin is used by .*first.*second/);
  });

  it('starts when every handler has a matching contract', async () => {
    current = await buildTestApp({ db: offlineDb() });
    const res = await current.app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
  });
});
