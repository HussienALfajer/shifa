import { describe, expect, it } from 'vitest';
import { hasPermission, type Principal } from '../../src/access/principal.ts';
import { PRODUCTION_GRANTS } from '../../src/access/roles.ts';
import {
  BRANCH_1,
  BRANCH_2,
  principalFor,
  TENANT_A,
  TENANT_B,
  TEST_GRANTS,
  TEST_READ,
  TEST_SENSITIVE,
} from './probe.ts';

const tenantScope = { tenantId: TENANT_A, branchId: null };
const branch1Scope = { tenantId: TENANT_A, branchId: BRANCH_1 };

describe('hasPermission', () => {
  it('grants a key the role holds tenant-wide in the same tenant', () => {
    expect(hasPermission(principalFor('owner'), TEST_SENSITIVE, tenantScope, TEST_GRANTS)).toBe(
      true,
    );
    expect(hasPermission(principalFor('doctor'), TEST_READ, branch1Scope, TEST_GRANTS)).toBe(true);
  });

  it('refuses a key the role does not hold', () => {
    expect(hasPermission(principalFor('doctor'), TEST_SENSITIVE, tenantScope, TEST_GRANTS)).toBe(
      false,
    );
    expect(hasPermission(principalFor('assistant'), TEST_READ, tenantScope, TEST_GRANTS)).toBe(
      false,
    );
  });

  it('refuses a role held only in another tenant', () => {
    const principal = principalFor('owner', {
      roles: [{ role: 'owner', tenantId: TENANT_B, branchId: null }],
    });
    expect(hasPermission(principal, TEST_READ, tenantScope, TEST_GRANTS)).toBe(false);
  });

  it('limits a branch role to its branch', () => {
    const principal = principalFor('doctor', {
      branchId: BRANCH_1,
      roles: [{ role: 'doctor', tenantId: TENANT_A, branchId: BRANCH_1 }],
    });
    expect(hasPermission(principal, TEST_READ, branch1Scope, TEST_GRANTS)).toBe(true);
    expect(
      hasPermission(principal, TEST_READ, { tenantId: TENANT_A, branchId: BRANCH_2 }, TEST_GRANTS),
    ).toBe(false);
    // A branch role never counts for a tenant-wide scope.
    expect(hasPermission(principal, TEST_READ, tenantScope, TEST_GRANTS)).toBe(false);
  });

  it('gives platform_admin no tenant grants, even when the grant map lists keys', () => {
    expect(hasPermission(principalFor('platform_admin'), TEST_READ, tenantScope, TEST_GRANTS)).toBe(
      false,
    );
  });

  it('refuses a scope without a tenant', () => {
    const principal: Principal = principalFor('owner');
    expect(
      hasPermission(principal, TEST_READ, { tenantId: null, branchId: null }, TEST_GRANTS),
    ).toBe(false);
  });

  it('production grants are empty for every role', () => {
    for (const keys of Object.values(PRODUCTION_GRANTS)) expect(keys).toEqual([]);
    expect(hasPermission(principalFor('owner'), TEST_READ, tenantScope, PRODUCTION_GRANTS)).toBe(
      false,
    );
  });
});
