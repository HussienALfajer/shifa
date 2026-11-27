// Injection tokens of the entitlements module.

/** The process's one PlatformDb (shared with the platform module, which closes it at shutdown). */
export const ENTITLEMENTS_PLATFORM_DB = Symbol('ENTITLEMENTS_PLATFORM_DB');
