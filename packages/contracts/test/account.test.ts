// A-01-09: the account schemas the A-01-07 screens use (profile, MFA status, recovery codes, the
// challenge's codes left, the chooser's tenant-wide flag, the reason of an ended session, the
// setup page's masked phone, the drawer's TOTP flag) and the declared statuses: every contract of
// an authenticated route declares 401, a public one never does.
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index.ts';
import {
  authChangePassword,
  authMfaChallenge,
  authMfaEnrolConfirm,
  authMfaRecoveryCodes,
  authMfaStatus,
  authSetupLinkConsume,
  authSignIn,
  CODE_MESSAGES,
  type Contract,
  ErrorBody,
  ErrorCode,
  MemberDetail,
  MfaPassed,
  MfaStatus,
  MyClinic,
  MyProfile,
  meProfile,
  meSwitch,
  RecoveryCodes,
  SetupLinkView,
  teamMemberResetMfa,
} from '../src/index.ts';

const UUID = '0193c5a4-7b2e-7c1a-9f00-000000000001';
const NOW = '2026-11-24T10:00:00.000Z';

const sessionView = {
  userId: UUID,
  sessionId: UUID,
  platformAdmin: false,
  mfa: 'verified',
  mfaRequired: true,
  tenantId: null,
  branchId: null,
  roles: [],
  idleMinutes: 15,
  idleExpiresAt: NOW,
  absoluteExpiresAt: NOW,
};

function isContract(value: unknown): value is Contract {
  return (
    typeof value === 'object' &&
    value !== null &&
    'operationId' in value &&
    'responses' in value &&
    'method' in value
  );
}

const allContracts = (Object.values(contracts) as unknown[]).filter(isContract);

describe('account schemas (A-01-09)', () => {
  it('MyProfile: id, name and phone', () => {
    expect(MyProfile.parse({ userId: UUID, name: 'شخص', phoneE164: '+963980039822' })).toBeTruthy();
    expect(() => MyProfile.parse({ userId: UUID, name: 'شخص' })).toThrow();
  });

  it('MfaStatus: enrolledAt and recoveryCodesLeft are null when not enrolled', () => {
    expect(
      MfaStatus.parse({ enrolled: false, enrolledAt: null, recoveryCodesLeft: null }),
    ).toBeTruthy();
    expect(MfaStatus.parse({ enrolled: true, enrolledAt: NOW, recoveryCodesLeft: 9 })).toBeTruthy();
    expect(() =>
      MfaStatus.parse({ enrolled: true, enrolledAt: NOW, recoveryCodesLeft: -1 }),
    ).toThrow();
  });

  it('RecoveryCodes and MfaPassed', () => {
    expect(RecoveryCodes.parse({ recoveryCodes: ['abcd-efgh'] })).toBeTruthy();
    expect(MfaPassed.parse({ session: sessionView, recoveryCodesLeft: 9 })).toBeTruthy();
    expect(() => MfaPassed.parse(sessionView)).toThrow();
  });

  it('MyClinic carries tenantWide', () => {
    const clinic = {
      tenantId: UUID,
      name: 'عيادة',
      status: 'active',
      selectable: true,
      roles: ['doctor'],
      lastActiveAt: null,
      solo: false,
      branches: [],
    };
    expect(() => MyClinic.parse(clinic)).toThrow();
    expect(MyClinic.parse({ ...clinic, tenantWide: false }).tenantWide).toBe(false);
  });

  it('ErrorBody.reason: idle, absolute or ended, optional', () => {
    for (const reason of ['idle', 'absolute', 'ended']) {
      expect(ErrorBody.parse({ code: 'session_expired', message: 'x', reason }).reason).toBe(
        reason,
      );
    }
    expect(() =>
      ErrorBody.parse({ code: 'session_expired', message: 'x', reason: 'other' }),
    ).toThrow();
    expect(ErrorBody.parse({ code: 'unauthorized', message: 'x' }).reason).toBeUndefined();
  });

  it('SetupLinkView.phoneMasked and MemberDetail.mfaEnrolled are required', () => {
    const view = {
      clinicName: null,
      personName: 'شخص',
      role: 'platform_admin',
      purpose: 'admin_setup',
      expiresAt: NOW,
    };
    expect(() => SetupLinkView.parse(view)).toThrow();
    expect(SetupLinkView.parse({ ...view, phoneMasked: '+963 ••• ••• 123' })).toBeTruthy();
    expect(MemberDetail.shape.mfaEnrolled).toBeDefined();
  });

  it('the new error codes exist, each with its fixed message', () => {
    for (const code of [
      'password_unchanged',
      'branch_required',
      'owner_mfa_platform',
      'mfa_already_enrolled',
      'mfa_not_started',
      'mfa_not_owed',
      'mfa_not_enrolled',
    ] as const) {
      expect(ErrorCode.options).toContain(code);
      expect(CODE_MESSAGES[code]).toEqual(expect.any(String));
    }
  });

  it('the new routes have their contracts', () => {
    expect([meProfile.method, meProfile.path]).toEqual(['GET', '/me']);
    expect([authChangePassword.method, authChangePassword.path]).toEqual([
      'POST',
      '/auth/password',
    ]);
    expect([authMfaStatus.method, authMfaStatus.path]).toEqual(['GET', '/auth/mfa']);
    expect([authMfaRecoveryCodes.method, authMfaRecoveryCodes.path]).toEqual([
      'POST',
      '/auth/mfa/recovery-codes',
    ]);
    expect([teamMemberResetMfa.method, teamMemberResetMfa.path]).toEqual([
      'POST',
      '/team/members/:id/reset-mfa',
    ]);
    expect(authMfaChallenge.responses[200]).toBe(MfaPassed);
    expect(Object.keys(authChangePassword.responses).sort()).toEqual(['200', '400', '401', '429']);
    expect(Object.keys(authMfaRecoveryCodes.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '409',
      '429',
    ]);
    expect(Object.keys(teamMemberResetMfa.responses).sort()).toEqual(['200', '401', '404', '409']);
  });
});

describe('declared statuses (A-01-09 1h)', () => {
  it('every authenticated contract declares 401; a public one does not', () => {
    const missing = allContracts
      .filter((c) => c.public !== true && !(401 in c.responses))
      .map((c) => c.operationId);
    expect(missing).toEqual([]);
    expect(authSignIn.public).toBe(true);
    expect(authSetupLinkConsume.public).toBe(true);
  });

  it('the statuses the A-01-07 analysis found undeclared are declared', () => {
    expect(400 in authSetupLinkConsume.responses).toBe(true);
    expect(400 in authMfaEnrolConfirm.responses).toBe(true);
    expect(400 in authMfaChallenge.responses).toBe(true);
    expect(400 in meSwitch.responses).toBe(true);
    expect(403 in meSwitch.responses).toBe(true);
  });

  it('red: defineContract adds 401 unless the contract is public', () => {
    const signed = contracts.defineContract({
      operationId: 'lintSigned',
      method: 'GET',
      path: '/lint',
      responses: { 200: null },
    });
    const open = contracts.defineContract({
      operationId: 'lintOpen',
      method: 'GET',
      path: '/lint',
      public: true,
      responses: { 200: null },
    });
    expect(401 in signed.responses).toBe(true);
    expect(401 in open.responses).toBe(false);
  });
});
