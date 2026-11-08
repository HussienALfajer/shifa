// Route contracts for the whole API: the start-up check and request validation (ADR-0013).
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { ContractCheck } from './contract-check.ts';
import { ContractValidationInterceptor } from './validation.ts';

@Module({
  imports: [DiscoveryModule],
  providers: [ContractCheck, { provide: APP_INTERCEPTOR, useClass: ContractValidationInterceptor }],
})
export class ContractModule {}
