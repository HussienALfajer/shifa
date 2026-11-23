// `pnpm --filter @shifa/api seed:super-admin --phone <phone> --name <name> [--allow-production]`
// (A-01a criterion 13): the only way to create a super admin. Reads the identity configuration
// (DATABASE_URL_AUTH, DATABASE_URL_PLATFORM, CLINIC_WEB_URL) and prints the one-time setup link
// once; the token is stored only as its hash. No route creates super admins.
import { createAuthDb, createPlatformDb } from '@shifa/db';
import { ConfigError, loadIdentityConfig } from '../src/config/env.ts';
// The seed's own files, not the module's index: they carry no decorators, so Node runs them as
// they are (the index pulls in Nest, which needs the bundle).
import { DEFAULT_CLINIC_WEB_URL } from '../src/modules/identity/links.ts';
import {
  parseSeedArgs,
  SeedError,
  seedSuperAdmin,
} from '../src/modules/identity/super-admin-seed.ts';

const fail = (message: string): never => {
  process.stderr.write(`seed:super-admin: ${message}\n`);
  process.exit(1);
};

let args: ReturnType<typeof parseSeedArgs> | undefined;
let config: ReturnType<typeof loadIdentityConfig> | undefined;
try {
  args = parseSeedArgs(
    process.argv.slice(2),
    process.env['NODE_ENV'],
    process.env['DEPLOYMENT_ENVIRONMENT'],
  );
  config = loadIdentityConfig(process.env);
} catch (err) {
  fail(err instanceof SeedError || err instanceof ConfigError ? err.message : 'invalid input');
}
if (!args || !config) process.exit(1);

const authDb = createAuthDb(config.databaseUrlAuth);
const platformDb = createPlatformDb(config.databaseUrlPlatform);
try {
  const seeded = await seedSuperAdmin({
    authDb,
    platformDb,
    phone: args.phone,
    name: args.name,
    clinicWebUrl: config.clinicWebUrl ?? DEFAULT_CLINIC_WEB_URL,
  });
  process.stdout.write(
    `Super admin created (${seeded.userId}). Setup link, valid until ` +
      `${seeded.expiresAt.toISOString()}, shown once:\n${seeded.setupUrl}\n`,
  );
} catch (err) {
  // Never the error's message from the database: it can echo the phone.
  fail(err instanceof SeedError ? err.message : 'the super admin could not be created');
} finally {
  await authDb.close();
  await platformDb.close();
}
