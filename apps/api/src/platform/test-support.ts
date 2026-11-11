// Test-only routes, registered only when NODE_ENV=test (config.testRoutes → AppModule). Never in
// production, never in the OpenAPI document (the generator builds the app without them); the
// route matrix lists them under TEST_ONLY_ROUTES.
import { Controller, Get, Module } from '@nestjs/common';
import { defineContract } from '@shifa/contracts';
import { z } from 'zod';
import { Public } from '../access/index.ts';
import { Contract } from './contract/index.ts';

export const TEST_FAILURE_ROUTE = 'GET /_test/fail';

/**
 * A synthetic value, not a person. The failing route quotes it in its error message, so the
 * smoke check (0.2-09b3) can assert it never reaches the error tracker or any telemetry store.
 */
export const TEST_FAILURE_MARKER = 'synthetic-patient-marker-7f3a91';

const testFailure = defineContract({
  operationId: 'testFailure',
  method: 'GET',
  path: '/_test/fail',
  responses: { 200: z.object({}).meta({ id: 'TestFailureResponse' }) },
});

@Controller('_test')
class TestFailureController {
  /**
   * Always fails with an unhandled error (500 `internal_error`). Public: the smoke check calls
   * it without credentials, and it answers nothing but the fixed error envelope.
   */
  @Public()
  @Contract(testFailure)
  @Get('fail')
  fail(): never {
    throw new Error(`synthetic failure for ${TEST_FAILURE_MARKER}`);
  }
}

@Module({ controllers: [TestFailureController] })
export class TestSupportModule {}
