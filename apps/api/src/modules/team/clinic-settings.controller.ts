// The clinic's own settings (A-01a criterion 9): automatic sign-out after 15, 30 or 60 idle
// minutes, owner only (`clinic.settings.manage`). The next request of every session in the clinic
// reads the new value; one audit row per change.
import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import {
  type ClinicSettings,
  clinicSettings,
  clinicUpdateSettings,
  type RequestBody,
} from '@shifa/contracts';
import { auditEvent, tenant } from '@shifa/db';
import { eq } from 'drizzle-orm';
import {
  CurrentScope,
  type RequestScope,
  RequirePermission,
  TenantDb,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';

@Controller('clinic/settings')
export class ClinicSettingsController {
  constructor(@Inject(TenantDb) private readonly tenants: TenantDb) {}

  @RequirePermission('clinic.settings.manage')
  @Contract(clinicSettings)
  @Get()
  read(@CurrentScope() scope: RequestScope): Promise<ClinicSettings> {
    return this.tenants.run(scope, async (tx) => {
      const [row] = await tx
        .select({ idleMinutes: tenant.idleMinutes })
        .from(tenant)
        .where(eq(tenant.id, scope.tenantId));
      if (!row) throw new Error('clinic row not visible in its own scope');
      return { idleMinutes: row.idleMinutes as ClinicSettings['idleMinutes'] };
    });
  }

  @RequirePermission('clinic.settings.manage')
  @Contract(clinicUpdateSettings)
  @Patch()
  update(
    @Body() body: RequestBody<typeof clinicUpdateSettings>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicSettings> {
    return this.tenants.run(scope, async (tx) => {
      const changed = await tx
        .update(tenant)
        .set({ idleMinutes: body.idleMinutes, updatedAt: new Date() })
        .where(eq(tenant.id, scope.tenantId))
        .returning({ id: tenant.id });
      if (changed.length !== 1) throw new Error('clinic settings not written');
      await tx.insert(auditEvent).values({
        tenantId: scope.tenantId,
        actorId: scope.userId,
        targetId: scope.tenantId,
        event: 'clinic.settings_changed',
        requestId: request.requestId,
        data: { idleMinutes: body.idleMinutes },
      });
      return { idleMinutes: body.idleMinutes };
    });
  }
}
