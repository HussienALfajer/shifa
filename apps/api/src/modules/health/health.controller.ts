import { Controller, Get, Inject } from '@nestjs/common';
import { HealthService } from './health.service.ts';

interface HealthStatus {
  status: 'ok';
}

/** Probes for the orchestrator. Bodies never carry host, version or error text. */
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  /** Process is up; never touches the database. */
  @Get('live')
  live(): HealthStatus {
    return { status: 'ok' };
  }

  /** Database reachable as shifa_app; 503 otherwise. */
  @Get('ready')
  async ready(): Promise<HealthStatus> {
    await this.health.assertReady();
    return { status: 'ok' };
  }
}
