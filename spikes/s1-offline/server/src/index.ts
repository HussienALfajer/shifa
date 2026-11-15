export { buildServer, type ServerOptions } from './app.ts';
export { AUDIENCE, newSigningKeys, type Principal, type SigningKeys } from './auth.ts';
export * from './commands.ts';
export {
  findTenant,
  type Identities,
  syntheticIdentities,
  type TenantIdentity,
} from './identities.ts';
export { redacting, stdoutSink } from './log.ts';
export type { Report } from './report.ts';

/** Path of the `s1` schema file, applied as shifa_owner. */
export const SCHEMA_SQL = new URL('../sql/schema.sql', import.meta.url);
