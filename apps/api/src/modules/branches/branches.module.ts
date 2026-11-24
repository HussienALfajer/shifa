// The branches bounded context (A-01-05): the clinic's locations. Tenant work through TenantDb
// (the guard's scope); ending the sessions of members left without a branch through identity.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { BranchesController } from './branches.controller.ts';
import { BranchesService } from './branches.service.ts';

@Module({})
export class BranchesModule {
  /** `identity`: the registered IdentityModule (MemberAccounts). */
  static register({
    identity,
  }: {
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: BranchesModule,
      imports: [identity],
      controllers: [BranchesController],
      providers: [BranchesService],
    };
  }
}
