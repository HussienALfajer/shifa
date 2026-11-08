// Test-only access fixtures: the test permission catalogue, grants for it, a header-driven
// AuthPort and a probe controller with one route per access kind. Nothing here is reachable from
// src/: production grants stay empty and production auth authenticates nobody.
import { Controller, Get } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthPort } from '../../src/access/auth.port.ts';
import { Public, RequirePermission } from '../../src/access/decorators.ts';
import type { PermissionKey } from '../../src/access/permissions.ts';
import type { Principal, RoleAssignment } from '../../src/access/principal.ts';
import { ROLES, type Role, type RoleGrants } from '../../src/access/roles.ts';

/** Test keys exist only in this file; production has no permission keys yet. */
// Double cast: keeps compiling once PERMISSIONS lists real keys.
export const TEST_READ = 'test.read' as unknown as PermissionKey;
export const TEST_SENSITIVE = 'test.sensitive' as unknown as PermissionKey;

export const TEST_GRANTS: RoleGrants = {
  owner: [TEST_READ, TEST_SENSITIVE],
  doctor: [TEST_READ],
  receptionist: [TEST_READ],
  assistant: [],
  accountant: [],
  // Granted here on purpose: platform_admin must still never pass a tenant-scoped check.
  platform_admin: [TEST_READ, TEST_SENSITIVE],
};

export const TENANT_A = '00000000-0000-4000-8000-00000000000a';
export const TENANT_B = '00000000-0000-4000-8000-00000000000b';
export const BRANCH_1 = '00000000-0000-4000-8000-000000000b01';
export const BRANCH_2 = '00000000-0000-4000-8000-000000000b02';

/** Header carrying a synthetic principal as JSON (tests only). */
export const PRINCIPAL_HEADER = 'x-test-principal';

/** A principal active in TENANT_A holding `role` tenant-wide there. */
export function principalFor(role: Role, overrides: Partial<Principal> = {}): Principal {
  const assignment: RoleAssignment = { role, tenantId: TENANT_A, branchId: null };
  return {
    userId: `user-${role}`,
    tenantId: TENANT_A,
    branchId: null,
    roles: [assignment],
    ...overrides,
  };
}

export function headersFor(principal: Principal | undefined): Record<string, string> {
  return principal ? { [PRINCIPAL_HEADER]: JSON.stringify(principal) } : {};
}

/** Reads the principal from PRINCIPAL_HEADER; no header → anonymous. */
export class HeaderAuthAdapter implements AuthPort {
  authenticate(request: FastifyRequest): Promise<Principal | null> {
    const raw = request.headers[PRINCIPAL_HEADER];
    if (typeof raw !== 'string') return Promise.resolve(null);
    return Promise.resolve(JSON.parse(raw) as Principal);
  }
}

export const ALL_ROLES: readonly Role[] = ROLES;

@Controller('__probe')
export class ProbeController {
  @Public()
  @Get('public')
  open(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission(TEST_READ)
  @Get('read')
  read(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission(TEST_SENSITIVE)
  @Get('sensitive')
  sensitive(): { ok: true } {
    return { ok: true };
  }
}
