// A-01-12: the API gaps of the approved A-01-08 drawings. The sensitive keys with each role's
// default and toggles on add (OD-102), the open link's expiry and the owner's own row, name and
// pending-phone corrections (OD-103), the invitation for another number (OD-104), branch restore
// (OD-105), the named 409s and the statuses the routes answer but did not declare.
import { describe, expect, it } from 'vitest';
import {
  AddMemberRequest,
  Branch,
  branchesCreate,
  branchesRestore,
  branchesUpdate,
  CODE_MESSAGES,
  ErrorCode,
  InvitationView,
  invitationAccept,
  invitationDecline,
  MemberDetail,
  MemberLinkIssued,
  MemberSummary,
  PermissionDefaults,
  teamAddMember,
  teamDeactivateMember,
  teamMemberLink,
  teamMemberPhone,
  teamMemberResetMfa,
  teamPermissions,
  teamReactivateMember,
  teamUpdateMember,
  UpdateMemberRequest,
} from '../src/index.ts';

const UUID = '0193c5a4-7b2e-7c1a-9f00-000000000001';
const NOW = '2026-11-24T10:00:00.000Z';

const statuses = (c: { responses: Readonly<Record<number, unknown>> }) =>
  Object.keys(c.responses).sort();

const member = {
  id: UUID,
  name: 'ريم',
  phone: '+963980000001',
  status: 'pending',
  roles: [],
  lastActiveAt: null,
  linkExpiresAt: NOW,
  isSelf: false,
};

describe('sensitive keys with role defaults, toggles on add (OD-102)', () => {
  it('GET /team/permissions → every sensitive key with the roles that grant it', () => {
    expect([teamPermissions.method, teamPermissions.path]).toEqual(['GET', '/team/permissions']);
    expect(teamPermissions.responses[200]).toBe(PermissionDefaults);
    expect(statuses(teamPermissions)).toEqual(['200', '401']);
    const body = { keys: [{ key: 'clinical.notes.view', roles: ['doctor', 'assistant'] }] };
    expect(PermissionDefaults.parse(body)).toEqual(body);
    expect(() => PermissionDefaults.parse({ keys: [{ key: 'x', roles: [] }] })).toThrow();
  });

  it('AddMemberRequest.permissions: optional switches of sensitive keys, at most 50', () => {
    const base = {
      name: 'ريم',
      phone: '0980 000 001',
      roles: [{ role: 'doctor', branchId: null }],
    };
    expect(AddMemberRequest.parse(base)).toEqual(base);
    const switched = { ...base, permissions: [{ key: 'clinical.notes.view', granted: false }] };
    expect(AddMemberRequest.parse(switched)).toEqual(switched);
    // On add there is no override to clear: `granted` is true or false.
    expect(() =>
      AddMemberRequest.parse({
        ...base,
        permissions: [{ key: 'clinical.notes.view', granted: null }],
      }),
    ).toThrow();
    const many = Array.from({ length: 51 }, () => ({ key: 'clinical.notes.view', granted: true }));
    expect(() => AddMemberRequest.parse({ ...base, permissions: many })).toThrow();
  });
});

describe('the team list: link expiry and the owner’s own row', () => {
  it('MemberSummary.linkExpiresAt (null without an open link) and isSelf; MemberDetail too', () => {
    expect(MemberSummary.parse(member)).toMatchObject({ linkExpiresAt: NOW, isSelf: false });
    expect(MemberSummary.parse({ ...member, linkExpiresAt: null }).linkExpiresAt).toBeNull();
    const noLink = { ...member, linkExpiresAt: undefined };
    expect(() => MemberSummary.parse(noLink)).toThrow();
    const noSelf = { ...member, isSelf: undefined };
    expect(() => MemberSummary.parse(noSelf)).toThrow();
    const detail = { ...member, permissions: [], isLastOwner: false, mfaEnrolled: false };
    expect(MemberDetail.parse({ ...detail, isSelf: true }).isSelf).toBe(true);
  });
});

describe('name and pending phone (OD-103)', () => {
  it('UpdateMemberRequest.name: a name as typed', () => {
    expect(UpdateMemberRequest.parse({ name: 'ريم الاستقبال' })).toEqual({ name: 'ريم الاستقبال' });
    expect(() => UpdateMemberRequest.parse({ name: '   ' })).toThrow();
    expect(() => UpdateMemberRequest.parse({ name: 'x'.repeat(201) })).toThrow();
  });

  it('PATCH /team/members/:id/phone { phone } → a new link', () => {
    expect([teamMemberPhone.method, teamMemberPhone.path]).toEqual([
      'PATCH',
      '/team/members/:id/phone',
    ]);
    expect(teamMemberPhone.responses[200]).toBe(MemberLinkIssued);
    expect(statuses(teamMemberPhone)).toEqual(['200', '400', '401', '404', '409']);
    expect(teamMemberPhone.request.params.parse({ id: UUID })).toEqual({ id: UUID });
    const body = teamMemberPhone.request.body;
    expect(body.parse({ phone: '0980 039 822' })).toEqual({ phone: '0980 039 822' });
    expect(() => body.parse({ phone: '' })).toThrow();
    expect(() => body.parse({ phone: 'x'.repeat(33) })).toThrow();
  });
});

describe('the invitation for another number (OD-104)', () => {
  it('InvitationView.phoneMasked', () => {
    const view = {
      clinicName: 'عيادة',
      personName: 'د. سامر',
      roles: [],
      expiresAt: NOW,
      phoneMasked: '+963 ••• ••• 822',
    };
    expect(InvitationView.parse(view).phoneMasked).toBe('+963 ••• ••• 822');
    const without = { ...view, phoneMasked: undefined };
    expect(() => InvitationView.parse(without)).toThrow();
  });

  it('accept and decline declare 403 (invitation_other_phone)', () => {
    expect(statuses(invitationAccept)).toEqual(['204', '401', '403', '404']);
    expect(statuses(invitationDecline)).toEqual(['204', '401', '403', '404']);
  });
});

describe('branch restore (OD-105)', () => {
  it('POST /branches/:id/restore → the branch', () => {
    expect([branchesRestore.method, branchesRestore.path]).toEqual([
      'POST',
      '/branches/:id/restore',
    ]);
    expect(branchesRestore.responses[200]).toBe(Branch);
    expect(statuses(branchesRestore)).toEqual(['200', '401', '404', '409']);
    expect(branchesRestore.request.params.parse({ id: UUID })).toEqual({ id: UUID });
  });
});

describe('new error codes', () => {
  it.each([
    'member_deactivated',
    'member_not_deactivated',
    'member_account_exists',
    'self_action',
    'invitation_other_phone',
    'branch_not_archived',
  ] as const)('%s is a code with its message', (code) => {
    expect(ErrorCode.options).toContain(code);
    expect(CODE_MESSAGES[code]).toEqual(expect.any(String));
  });
});

describe('declared statuses (A-01-12 1i)', () => {
  it('400 on add, update, branch create and branch update', () => {
    expect(statuses(teamAddMember)).toEqual(['201', '400', '401', '409']);
    expect(statuses(teamUpdateMember)).toEqual(['200', '400', '401', '404', '409']);
    // A-02-03: 409 `limit_reached` beyond the branch limit.
    expect(statuses(branchesCreate)).toEqual(['201', '400', '401', '409']);
    expect(statuses(branchesUpdate)).toEqual(['200', '400', '401', '404', '409']);
  });

  it('409 on deactivate, reactivate, new link and TOTP reset', () => {
    for (const c of [teamDeactivateMember, teamReactivateMember, teamMemberResetMfa]) {
      expect(statuses(c)).toEqual(['200', '401', '404', '409']);
    }
    expect(statuses(teamMemberLink)).toEqual(['200', '401', '404', '409']);
  });
});
