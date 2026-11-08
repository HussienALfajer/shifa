// Fail-closed at start: a handler without an access annotation, or with both, stops the app.
import { Controller, Get, Post } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { Public, RequirePermission } from '../../src/access/decorators.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildTestApp, offlineDb, type TestApp, testContract } from '../support.ts';
import { TEST_READ } from './probe.ts';

// Every handler has a contract, so only the access check can refuse these apps.

@Controller('__unannotated')
class UnannotatedController {
  @Public()
  @Contract(testContract('GET', '/__unannotated/fine'))
  @Get('fine')
  fine(): string {
    return 'ok';
  }

  @Contract(testContract('GET', '/__unannotated/missing'))
  @Get('missing')
  forgotten(): string {
    return 'never';
  }

  @Contract(testContract('POST', '/__unannotated/also-missing'))
  @Post('also-missing')
  alsoForgotten(): string {
    return 'never';
  }

  /** Not a route handler: needs no annotation. */
  helper(): string {
    return 'helper';
  }
}

@Controller('__both')
class BothController {
  @Public()
  @RequirePermission(TEST_READ)
  @Contract(testContract('GET', '/__both/confused'))
  @Get('confused')
  confused(): string {
    return 'never';
  }
}

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

describe('access check at start', () => {
  it('refuses to start and names every unannotated handler', async () => {
    const start = buildTestApp({ db: offlineDb(), controllers: [UnannotatedController] });
    await expect(start).rejects.toThrow(/UnannotatedController\.forgotten/);
    await expect(start).rejects.toThrow(/UnannotatedController\.alsoForgotten/);
    await expect(start).rejects.not.toThrow(/UnannotatedController\.(fine|helper)/);
  });

  it('refuses to start when a handler has both @Public and @RequirePermission', async () => {
    const start = buildTestApp({ db: offlineDb(), controllers: [BothController] });
    await expect(start).rejects.toThrow(/BothController\.confused/);
  });

  it('starts when every handler is annotated', async () => {
    current = await buildTestApp({ db: offlineDb() });
    const res = await current.app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
  });
});
