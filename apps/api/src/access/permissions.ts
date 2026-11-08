// Permission keys (PLT-46). Phase A adds the real catalogue here; until then the list is empty,
// so `PermissionKey` has no values and production code cannot name or grant any permission.
// Tests define their own keys in test/access/probe.ts.

export const PERMISSIONS = [] as const satisfies readonly string[];

export type PermissionKey = (typeof PERMISSIONS)[number];
