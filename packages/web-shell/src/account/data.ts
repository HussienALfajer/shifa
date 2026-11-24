// The reads of My account and the clinic setting (slice A-01-10 checkpoint 2). Personal reads are
// keyed by the person (`['me', userId, …]`), the clinic's by the clinic first (`['clinic',
// tenantId, …]`), so the router's rule drops them when the person or clinic changes. Never
// retried or refetched by themselves: every request is activity to the server.
import type { Schemas } from '@shifa/api-client-ts';
import { useQuery } from '@tanstack/react-query';
import { useShell } from '../providers.tsx';
import { type SessionView, useSession } from '../session.ts';

export type MyProfile = Schemas['MyProfile'];
export type MfaStatus = Schemas['MfaStatus'];
export type SessionSummary = Schemas['SessionSummary'];
export type MyClinic = Schemas['MyClinic'];

const QUIET = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const profileKey = (userId: string) => ['me', userId] as const;
export const mfaKey = (userId: string) => ['me', userId, 'mfa'] as const;
export const sessionsKey = (userId: string) => ['me', userId, 'sessions'] as const;
// Not the chooser's `['me', userId, 'clinics']`: that entry holds another shape.
export const clinicsKey = (userId: string) => ['me', userId, 'active-clinic'] as const;
export const settingsKey = (tenantId: string) => ['clinic', tenantId, 'settings'] as const;

/** The signed-in session, once known (the guard let only signed-in people in). */
export function useSignedIn(): SessionView | undefined {
  const { shell } = useShell();
  const state = useSession(shell);
  return state?.kind === 'signed-in' ? state.session : undefined;
}

export const isOwner = (session: SessionView | undefined) =>
  session?.roles.some((r) => r.role === 'owner' && r.tenantId === session.tenantId) === true;

/** Shares `['me', userId]` with `useMyName()`: one read of GET /me for both. */
export function useProfile(userId: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: async (): Promise<MyProfile | null> => {
      const { data } = await shell.api.GET('/me');
      return data?.userId === userId ? data : null;
    },
    staleTime: Number.POSITIVE_INFINITY,
    ...QUIET,
  });
}

export function useMfaStatus(userId: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: mfaKey(userId),
    queryFn: async (): Promise<MfaStatus> => {
      const { data } = await shell.api.GET('/auth/mfa');
      if (!data) throw new Error('GET /auth/mfa failed');
      return data;
    },
    staleTime: 60_000,
    ...QUIET,
  });
}

export function useSessions(userId: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: sessionsKey(userId),
    queryFn: async (): Promise<SessionSummary[]> => {
      const { data } = await shell.api.GET('/auth/sessions');
      if (!data) throw new Error('GET /auth/sessions failed');
      return data.sessions;
    },
    staleTime: 0,
    ...QUIET,
  });
}

/** The active clinic's name and the person's roles there, from GET /me/clinics. */
export function useActiveClinic(session: SessionView | undefined): MyClinic | undefined {
  const { shell } = useShell();
  const userId = session?.userId ?? '';
  const { data } = useQuery({
    queryKey: clinicsKey(userId),
    queryFn: async () => {
      const { data: clinics } = await shell.api.GET('/me/clinics');
      return clinics ?? null;
    },
    enabled: session !== undefined,
    staleTime: 60_000,
    ...QUIET,
  });
  return data?.clinics.find((c) => c.tenantId === session?.tenantId);
}

export function useClinicSettings(tenantId: string, enabled: boolean) {
  const { shell } = useShell();
  return useQuery({
    queryKey: settingsKey(tenantId),
    queryFn: async () => {
      const { data } = await shell.api.GET('/clinic/settings');
      if (!data) throw new Error('GET /clinic/settings failed');
      return data;
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    ...QUIET,
  });
}
