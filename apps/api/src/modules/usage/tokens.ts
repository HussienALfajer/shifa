// Injection tokens of the usage module.

/** The process's one PlatformDb (shared with the platform module, which closes it at shutdown). */
export const USAGE_PLATFORM_DB = Symbol('USAGE_PLATFORM_DB');
