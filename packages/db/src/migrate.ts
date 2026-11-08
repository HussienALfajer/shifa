import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));
export const ROLES_SQL = fileURLToPath(new URL('../sql/roles.sql', import.meta.url));

/**
 * Applies pending migrations as `shifa_owner` (the schema owner). Never call it with the
 * application role's URL: shifa_app has no right to change the schema.
 */
export async function migrate(ownerUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: ownerUrl, max: 1 });
  try {
    await drizzleMigrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}
