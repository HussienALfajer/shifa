// The team bounded context (A-01-04): members, roles per clinic or branch, sensitive toggles,
// links, and the clinic's own settings. Tenant work through TenantDb (the guard's scope); the
// person's account (sessions, password, whether a phone has an account) through identity.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { ClinicSettingsController } from './clinic-settings.controller.ts';
import { MemberCorrections } from './member-corrections.ts';
import { TeamController } from './team.controller.ts';
import { TeamService } from './team.service.ts';
import { TeamPermissionsController } from './team-permissions.controller.ts';

@Module({})
export class TeamModule {
  /** `identity`: the registered IdentityModule (MemberAccounts). */
  static register({
    identity,
  }: {
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: TeamModule,
      imports: [identity],
      controllers: [TeamController, TeamPermissionsController, ClinicSettingsController],
      providers: [TeamService, MemberCorrections],
    };
  }
}
