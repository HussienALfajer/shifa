// Injection tokens of the flags module.

/** The process's one PlatformDb (shared with the platform module, which closes it at shutdown). */
export const FLAGS_PLATFORM_DB = Symbol('FLAGS_PLATFORM_DB');
