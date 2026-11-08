import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ShifaDb } from '@shifa/db';
import { sql } from 'drizzle-orm';
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
        this.db.withPlatformAdmin('health-check', (tx) => tx.execute(sql`select 1`)),
        timeout,
      ]);
    } catch (err) {
      throw new ServiceUnavailableException(undefined, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }
}
