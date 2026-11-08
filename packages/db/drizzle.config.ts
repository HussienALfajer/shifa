import { defineConfig } from 'drizzle-kit';

// Generates migrations only; drizzle-kit never connects (migrations run through src/migrate.ts).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
});
