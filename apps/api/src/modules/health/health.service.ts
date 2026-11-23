import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ShifaDb } from '@shifa/db';
import { SHIFA_DB } from '../../platform/database.module.ts';

/** A readiness probe that hangs is as bad as one that fails. */
const READY_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  constructor(@Inject(SHIFA_DB) private readonly db: ShifaDb) {}

  /**
   * Throws 503 unless `select 1` succeeds within the timeout. The cause travels with the
   * exception; the global filter logs it sanitised and never sends it to the client.
   */
  async assertReady(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`database did not answer within ${String(READY_TIMEOUT_MS)} ms`));
      }, READY_TIMEOUT_MS);
    });
    try {
      await Promise.race([
        // Role check + `select 1` with no tenant and no platform context (backlog L2).
        this.db.ping(),
        timeout,
      ]);
    } catch (err) {
      throw new ServiceUnavailableException(undefined, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }
}
