// The sensitive keys with each role's default (A-01b criteria 2 and 7, OD-102): the member drawer
// shows them on add, before the member exists. Read from the injected catalogue and the grants;
// no tenant data.
import { Controller, Get, Inject } from '@nestjs/common';
import { type PermissionDefaults, teamPermissions } from '@shifa/contracts';
import { RequirePermission } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { TeamService } from './team.service.ts';

@Controller('team')
export class TeamPermissionsController {
  constructor(@Inject(TeamService) private readonly team: TeamService) {}

  @RequirePermission('members.view')
  @Contract(teamPermissions)
  @Get('permissions')
  permissions(): PermissionDefaults {
    return this.team.permissionDefaults();
  }
}
