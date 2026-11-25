// The team's reads (slice A-01-08 checkpoint 3): GET /team/members, /team/members/:id,
// /team/permissions and /branches, keyed by the clinic first (`['clinic', tenantId, …]`) so the
// router drops them when the person, clinic or branch changes. Never retried or refetched by
// themselves: every request is activity to the server. Also the words of statuses, roles and keys.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { useQuery } from '@tanstack/react-query';
import { ROLE_TEXT, type Role } from '../chooser/chooser-text.ts';
import { useShell } from '../providers.tsx';

export type MemberSummary = Schemas['MemberSummary'];
export type MemberDetail = Schemas['MemberDetail'];
export type MemberLink = Schemas['MemberLinkIssued'];
export type MemberStatus = MemberSummary['status'];
export type Branch = Schemas['Branch'];
export type BranchList = Schemas['BranchList'];
export type RoleScope = Schemas['RoleScopeInput'];
export type { Role };

const QUIET = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const teamKey = (tenantId: string) => ['clinic', tenantId, 'team'] as const;
export const memberKey = (tenantId: string, id: string) =>
  ['clinic', tenantId, 'team', 'member', id] as const;
const permissionsKey = (tenantId: string) => ['clinic', tenantId, 'team-permissions'] as const;
export const branchesKey = (tenantId: string) => ['clinic', tenantId, 'branches'] as const;

/** The order roles are listed in, as the server lists them. */
export const ROLES: readonly Role[] = [
  'owner',
  'doctor',
  'assistant',
  'receptionist',
  'accountant',
];

/** The role's word in the team: the owner's in full («مالك العيادة»). */
export const ROLE_WORD: Record<Role, CommonKey> = { ...ROLE_TEXT, owner: 'setupRoleOwner' };

export const STATUSES: readonly MemberStatus[] = ['active', 'pending', 'deactivated'];

export const STATUS_WORD = {
  active: 'memberActive',
  pending: 'memberPending',
  deactivated: 'memberDeactivated',
} as const satisfies Record<MemberStatus, CommonKey>;

export const STATUS_TONE = {
  active: 'success',
  pending: 'neutral',
  deactivated: 'warning',
} as const satisfies Record<MemberStatus, string>;

/** The sensitive keys' words; a key without one shows as itself (a key added later). */
export const PERMISSION_WORD: Record<string, CommonKey> = {
  'clinical.notes.view': 'permClinicalNotesView',
};

export const NAME_MAX = 200;
export const PHONE_MAX = 32;

/** A link still open: its expiry is ahead. */
export const linkOpen = (m: Pick<MemberSummary, 'linkExpiresAt'>, now = Date.now()) =>
  m.linkExpiresAt !== null && Date.parse(m.linkExpiresAt) > now;

export function useTeam(tenantId: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: teamKey(tenantId),
    queryFn: async (): Promise<MemberSummary[]> => {
      const { data } = await shell.api.GET('/team/members');
      if (!data) throw new Error('GET /team/members failed');
      return data.members;
    },
    staleTime: 30_000,
    ...QUIET,
  });
}

/** Null when the member is no longer in the team (404). */
export function useMember(tenantId: string, id: string | null) {
  const { shell } = useShell();
  return useQuery({
    queryKey: memberKey(tenantId, id ?? ''),
    queryFn: async (): Promise<MemberDetail | null> => {
      const { data, response } = await shell.api.GET('/team/members/{id}', {
        params: { path: { id: id ?? '' } },
      });
      if (data) return data;
      if (response.status === 404) return null;
      throw new Error('GET /team/members/:id failed');
    },
    enabled: id !== null,
    staleTime: Number.POSITIVE_INFINITY,
    ...QUIET,
  });
}

/** The sensitive keys with the roles that grant each by default (OD-102). */
export function usePermissionDefaults(tenantId: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: permissionsKey(tenantId),
    queryFn: async () => {
      const { data } = await shell.api.GET('/team/permissions');
      if (!data) throw new Error('GET /team/permissions failed');
      return data.keys;
    },
    staleTime: Number.POSITIVE_INFINITY,
    ...QUIET,
  });
}

function useBranchQuery<T>(tenantId: string, select: (list: BranchList) => T) {
  const { shell } = useShell();
  return useQuery({
    queryKey: branchesKey(tenantId),
    queryFn: async (): Promise<BranchList> => {
      const { data } = await shell.api.GET('/branches');
      // Not the lists (another answer in tests, a proxy page): failed, never half a list.
      if (!data || !Array.isArray(data.active) || !Array.isArray(data.archived)) {
        throw new Error('GET /branches failed');
      }
      return data;
    },
    select,
    staleTime: 60_000,
    ...QUIET,
  });
}

const activeOf = (list: BranchList) => list.active;
const whole = (list: BranchList) => list;

/** The clinic's active branches (role scopes). */
export function useBranches(tenantId: string) {
  return useBranchQuery(tenantId, activeOf);
}

/** Active and archived branches (the branches page, checkpoint 4); one read with the above. */
export function useBranchList(tenantId: string) {
  return useBranchQuery(tenantId, whole);
}
