import { type DynamicModule, Module } from '@nestjs/common';
import type { ShifaDb } from '@shifa/db';
import { AccessModule } from './access/index.ts';
import { HealthModule } from './modules/health/index.ts';
import { ContractModule } from './platform/contract/index.ts';
import { DatabaseModule } from './platform/database.module.ts';

/** Root module. Product modules live in src/modules/<context>/ behind an index.ts. */
@Module({})
export class AppModule {
  static register({ db }: { db: ShifaDb }): DynamicModule {
    return {
      module: AppModule,
      imports: [DatabaseModule.register(db), AccessModule, ContractModule, HealthModule],
    };
  }
}
