// Injection tokens of the identity module.

/** The process's one AuthDb (createAuthDb() as shifa_auth, ADR-0043). */
export const AUTH_DB = Symbol('AUTH_DB');

/** IdentityConfig from config/env.ts (secrets; never logged). */
export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');

/** The Better Auth instance (better-auth.ts). */
export const BETTER_AUTH = Symbol('BETTER_AUTH');

export interface IdentitySecrets {
  /** BETTER_AUTH_SECRET: signs the session cookie. */
  betterAuthSecret: string;
  /** AUTH_HMAC_KEY: keys the sign-in throttle rows. */
  hmacKey: string;
}
