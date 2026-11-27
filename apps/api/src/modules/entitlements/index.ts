// Public surface of the entitlements module: other code imports from here, never from its files.
export { EntitlementsAdmin } from './admin.service.ts';
export {
  CachedEntitlements,
  ENTITLEMENT_TTL_MS,
  ENTITLEMENTS,
  type EntitlementsPort,
  TenantCache,
} from './cache.ts';
export {
  assertEntitlementKeysKnown,
  ENTITLEMENT_CATALOGUE,
  EntitlementCatalogue,
  type EntitlementDefinition,
  PRODUCTION_ENTITLEMENTS,
  UnknownEntitlementError,
} from './catalogue.ts';
export { EntitlementsModule } from './entitlements.module.ts';
export { ClinicLimits, type EnforcedLimit } from './limits.ts';
export { type Usage, usageInClinic } from './usage-counts.ts';
export {
  type AddonSource,
  type EntitlementSources,
  type OverrideSource,
  resolveAll,
  resolveKey,
} from './resolve.ts';
