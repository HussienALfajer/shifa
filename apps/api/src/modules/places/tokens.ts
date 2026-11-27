// Injection tokens of the places module.

/** The process's one PlatformDb (shared with the platform module, which closes it at shutdown). */
export const PLACES_PLATFORM_DB = Symbol('PLACES_PLATFORM_DB');
