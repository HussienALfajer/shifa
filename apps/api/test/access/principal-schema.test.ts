// A-01a criterion 15: the AuthPort contract as a Zod schema. A principal names an opaque UUID
// user; its branch belongs to its active tenant (no branch without a tenant); its roles hold only
// in that tenant (server-side memberships of the active clinic); nothing else rides along.
import { describe, expect, it } from 'vitest';
import { PrincipalSchema, parsePrincipal } from '../../src/access/principal.ts';

const USER = '0b6f2a4e-6c1d-4d7a-9b0e-2f4c5a6b7c8d';
const SESSION = '1c7e3b5f-7d2e-4e8b-8c1f-3a5d6b7c8e9f';
const TENANT = '2d8f4c6a-8e3f-4f9c-9d2a-4b6e7c8d9fa0';
const OTHER = '3e9a5d7b-9f4a-4a0d-8e3b-5c7f8d9eab1c';
const BRANCH = '4fab6e8c-a05b-4b1e-9f4c-6d8a9eafbc2d';

const valid = {
  userId: USER,
  sessionId: SESSION,
  tenantId: TENANT,
  branchId: BRANCH,
  roles: [{ role: 'owner', tenantId: TENANT, branchId: null }],
};

describe('PrincipalSchema (AuthPort contract)', () => {
  it('accepts a principal of the documented shape', () => {
    expect(parsePrincipal(valid)).toEqual(valid);
  });

  it('accepts a signed-in person without an active clinic', () => {
    const none = { ...valid, tenantId: null, branchId: null, roles: [] };
    expect(parsePrincipal(none)).toEqual(none);
  });

  it.each([
    ['a user id that is not a UUID', { ...valid, userId: '+963940012345' }],
    ['a session id that is not a UUID', { ...valid, sessionId: 'token-abc' }],
    ['a branch without a tenant', { ...valid, tenantId: null, roles: [] }],
    [
      'a role in another tenant',
      { ...valid, roles: [{ role: 'owner', tenantId: OTHER, branchId: null }] },
    ],
    ['roles without an active tenant', { ...valid, tenantId: null, branchId: null }],
    ['an unknown role', { ...valid, roles: [{ role: 'root', tenantId: TENANT, branchId: null }] }],
    ['an extra field (a phone, a token)', { ...valid, phone: '+963940012345' }],
  ])('refuses %s', (_label, candidate) => {
    expect(PrincipalSchema.safeParse(candidate).success).toBe(false);
  });

  it('a refusal names no value: the error message lists paths only', () => {
    let message = '';
    try {
      parsePrincipal({ ...valid, userId: '+963940012345', extra: 'token-secret-value' });
    } catch (err) {
      message = err instanceof Error ? `${err.name} ${err.message} ${JSON.stringify(err)}` : '';
    }
    expect(message).toMatch(/principal/i);
    expect(message).not.toContain('963940012345');
    expect(message).not.toContain('token-secret-value');
  });
});
