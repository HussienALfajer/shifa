// Every route handler declares its contract (ADR-0013); the start-up check refuses anything else.
import { SetMetadata } from '@nestjs/common';
import type { Contract as ContractDefinition } from '@shifa/contracts';

export const CONTRACT_METADATA = 'shifa:contract';

/** Binds a handler to its contract from `@shifa/contracts`: validates requests, feeds OpenAPI. */
export const Contract = (contract: ContractDefinition): MethodDecorator =>
  SetMetadata(CONTRACT_METADATA, contract);
