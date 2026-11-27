// Injection tokens of the settings module.

/** The process's one PlatformDb (shared with the platform module, which closes it at shutdown). */
export const SETTINGS_PLATFORM_DB = Symbol('SETTINGS_PLATFORM_DB');
