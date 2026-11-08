import { Controller, Get, Inject } from '@nestjs/common';
import { type HealthStatus, healthLive, healthReady } from '@shifa/contracts';
import { Public } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { HealthService } from './health.service.ts';

/** Probes for the orchestrator. Bodies never carry host, version or error text. */
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  /** Process is up; never touches the database. */
  @Public()
  @Contract(healthLive)
  @Get('live')
  live(): HealthStatus {
    return { status: 'ok' };
  }

  /** Database reachable as shifa_app; 503 otherwise. */
  @Public()
  @Contract(healthReady)
  @Get('ready')
  async ready(): Promise<HealthStatus> {
    await this.health.assertReady();
    return { status: 'ok' };
  }
}
