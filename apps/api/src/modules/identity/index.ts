// Public surface of the identity module: other code imports from here, never from its files.
export { BetterAuthAdapter } from './better-auth.adapter.ts';
export { IdentityModule, type IdentityModuleOptions } from './identity.module.ts';
export {
  checkPasswordRules,
  isCommonPassword,
  type PasswordProblem,
} from './password-rules.ts';
export { SESSION_COOKIE } from './session-cookie.ts';
export type { IdentitySecrets } from './tokens.ts';
