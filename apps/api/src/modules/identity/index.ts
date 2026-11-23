// Public surface of the identity module: other code imports from here, never from its files.
export { BetterAuthAdapter } from './better-auth.adapter.ts';
export { IdentityModule, type IdentityModuleOptions } from './identity.module.ts';
export { DEFAULT_CLINIC_WEB_URL } from './links.ts';
export { MemberAccounts, type NewMemberLink } from './member-accounts.service.ts';
export { type ActionBy, type NewSetupLink, OwnerAccounts } from './owner-accounts.service.ts';
export {
  checkPasswordRules,
  isCommonPassword,
  type PasswordProblem,
} from './password-rules.ts';
export { SESSION_COOKIE } from './session-cookie.ts';
export {
  parseSeedArgs,
  type SeedArgs,
  SeedError,
  type SeededSuperAdmin,
  type SeedSuperAdminInput,
  seedSuperAdmin,
} from './super-admin-seed.ts';
export type { IdentitySecrets } from './tokens.ts';
