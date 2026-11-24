// A-01-11: the API gaps of the approved A-01-10 drawings. Self re-enrolment of TOTP (OD-98),
// the owner card's masked phone and link expiry, the owner's status in the clinics list, the
// pending owner's phone edit (OD-99), the named 409s of no-op owner actions, and the statuses
// the routes answer but did not declare.
import { describe, expect, it } from 'vitest';
import {
  authMfaReenrolConfirm,
  authMfaReenrolStart,
  CODE_MESSAGES,
  ClinicDetail,
  ClinicSummary,
  clinicUpdateSettings,
  ErrorCode,
  platformCreateClinic,
  platformOwnerEndSessions,
  platformOwnerPhone,
  platformOwnerResetMfa,
  platformUpdateClinic,
  RecoveryCodes,
  SetupLinkIssued,
  TotpEnrolStart,
} from '../src/index.ts';

const UUID = '0193c5a4-7b2e-7c1a-9f00-000000000001';
const NOW = '2026-11-24T10:00:00.000Z';

const summary = {
  id: UUID,
  name: 'عيادة',
  type: 'solo',
  status: 'trial',
  subscriptionEnd: null,
  ownerName: 'مالك',
  createdAt: NOW,
};
const owner = { membershipId: UUID, name: 'مالك', status: 'pending' };

const statuses = (c: { responses: Readonly<Record<number, unknown>> }) =>
  Object.keys(c.responses).sort();

describe('self re-enrolment of TOTP (OD-98)', () => {
  it('start: POST /auth/mfa/re-enrol/start with a code from the old app → a new key', () => {
    expect([authMfaReenrolStart.method, authMfaReenrolStart.path]).toEqual([
      'POST',
      '/auth/mfa/re-enrol/start',
    ]);
    expect(authMfaReenrolStart.responses[200]).toBe(TotpEnrolStart);
    expect(statuses(authMfaReenrolStart)).toEqual(['200', '400', '401', '409', '429']);
    const body = authMfaReenrolStart.request.body;
    expect(body.parse({ code: '123456' })).toEqual({ code: '123456' });
    expect(() => body.parse({ code: '12345' })).toThrow();
    expect(() => body.parse({})).toThrow();
  });

  it('confirm: POST /auth/mfa/re-enrol/confirm with a code from the new app → ten codes', () => {
    expect([authMfaReenrolConfirm.method, authMfaReenrolConfirm.path]).toEqual([
      'POST',
      '/auth/mfa/re-enrol/confirm',
    ]);
    expect(authMfaReenrolConfirm.responses[200]).toBe(RecoveryCodes);
    expect(statuses(authMfaReenrolConfirm)).toEqual(['200', '400', '401', '409', '429']);
    const body = authMfaReenrolConfirm.request.body;
    expect(body.parse({ code: '654321' })).toEqual({ code: '654321' });
    expect(() => body.parse({ code: 'abcdef' })).toThrow();
  });
});

describe('owner card and clinics list (A-01a 3, 13)', () => {
  it('ClinicDetail.owner carries the masked phone and the open link’s expiry', () => {
    const detail = {
      ...summary,
      ownerStatus: 'pending',
      owner: { ...owner, phoneMasked: '+963 ••• ••• 123', linkExpiresAt: NOW },
    };
    expect(ClinicDetail.parse(detail).owner).toMatchObject({
      phoneMasked: '+963 ••• ••• 123',
      linkExpiresAt: NOW,
    });
    expect(
      ClinicDetail.parse({ ...detail, owner: { ...detail.owner, linkExpiresAt: null } }).owner
        ?.linkExpiresAt,
    ).toBeNull();
    expect(() => ClinicDetail.parse({ ...detail, owner })).toThrow();
  });

  it('ClinicSummary.ownerStatus: a membership status, or null without an owner row', () => {
    for (const ownerStatus of ['pending', 'active', 'deactivated', null]) {
      expect(ClinicSummary.parse({ ...summary, ownerStatus }).ownerStatus).toBe(ownerStatus);
    }
    expect(() => ClinicSummary.parse(summary)).toThrow();
    expect(() => ClinicSummary.parse({ ...summary, ownerStatus: 'other' })).toThrow();
  });
});

describe('pending owner’s phone (OD-99)', () => {
  it('PATCH /platform/clinics/:id/owner { phone } → a new setup link', () => {
    expect([platformOwnerPhone.method, platformOwnerPhone.path]).toEqual([
      'PATCH',
      '/platform/clinics/:id/owner',
    ]);
    expect(platformOwnerPhone.responses[200]).toBe(SetupLinkIssued);
    expect(statuses(platformOwnerPhone)).toEqual(['200', '400', '401', '404', '409']);
    expect(platformOwnerPhone.request.params.parse({ id: UUID })).toEqual({ id: UUID });
    const body = platformOwnerPhone.request.body;
    expect(body.parse({ phone: '0980 039 822' })).toEqual({ phone: '0980 039 822' });
    expect(() => body.parse({ phone: '' })).toThrow();
    expect(() => body.parse({ phone: 'x'.repeat(33) })).toThrow();
  });

  it('owner_account_exists is a new code with its message; owner_setup_pending covers both uses', () => {
    expect(ErrorCode.options).toContain('owner_account_exists');
    expect(CODE_MESSAGES.owner_account_exists).toEqual(expect.any(String));
    expect(CODE_MESSAGES.owner_setup_pending).toBe(
      'The clinic’s owner has not set up their account yet',
    );
  });
});

describe('declared statuses (A-01-11 1f, 1g)', () => {
  it('reset MFA and end sessions declare 409 (owner without an account)', () => {
    expect(statuses(platformOwnerResetMfa)).toEqual(['204', '401', '404', '409']);
    expect(statuses(platformOwnerEndSessions)).toEqual(['204', '401', '404', '409']);
  });

  it('400 on clinic creation and edit; 400 and 403 on the clinic settings', () => {
    expect(statuses(platformCreateClinic)).toEqual(['201', '400', '401', '409']);
    expect(statuses(platformUpdateClinic)).toEqual(['200', '400', '401', '404']);
    expect(statuses(clinicUpdateSettings)).toEqual(['200', '400', '401', '403']);
  });
});
