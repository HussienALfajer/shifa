// The process's single database handle (createDb() as shifa_app), closed at shutdown.
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ShifaDb } from '@shifa/db';

/** Injection token for the ShifaDb handle: `@Inject(SHIFA_DB) db: ShifaDb`. */
export const SHIFA_DB = Symbol('SHIFA_DB');

@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(SHIFA_DB) private readonly db: ShifaDb) {}

  /** `db` is created once in main.ts (or by a test) and owned by this module from then on. */
  static register(db: ShifaDb): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [{ provide: SHIFA_DB, useValue: db }],
      exports: [SHIFA_DB],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}
