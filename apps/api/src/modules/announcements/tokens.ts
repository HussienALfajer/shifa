// Injection tokens of the announcements module.

/** The process's one PlatformDb (shared with the platform module, which closes it at shutdown). */
export const ANNOUNCEMENTS_PLATFORM_DB = Symbol('ANNOUNCEMENTS_PLATFORM_DB');
