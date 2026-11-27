// What the active clinic's plan allows (slice A-02-10; contract row "Every page · what the plan
// allows"): GET /clinic/capabilities, read with the session by the frame and kept in the query
// cache, so the last answer is shown offline. An item the plan does not allow is absent; a full
// limit disables its add with the limit named. An answer of another shape counts as none: the
// screens then show what they showed before A-02 (the server refuses what the plan does not allow).
import type { Schemas } from '@shifa/api-client-ts';
import { useQuery } from '@tanstack/react-query';
import { useShell } from './providers.tsx';

export type Capabilities = Schemas['Capabilities'];
export type LimitUse = Schemas['LimitUse'];

export const capabilitiesKey = (tenantId: string) => ['clinic', tenantId, 'capabilities'] as const;

const isLimit = (l: unknown): l is LimitUse => {
  const x = l as { key?: unknown; limit?: unknown; used?: unknown } | null;
  return (
    typeof x?.key === 'string' &&
    typeof x.limit === 'number' &&
    (typeof x.used === 'number' || x.used === null)
  );
};

/** The limits of an answer, or null when it is not the contract's shape. */
export function limitsOf(body: unknown): LimitUse[] | null {
  const limits = (body as { limits?: unknown } | null)?.limits;
  return Array.isArray(limits) && limits.every(isLimit) ? limits : null;
}

export function useCapabilities(tenantId: string | null | undefined) {
  const { shell } = useShell();
  return useQuery({
    queryKey: capabilitiesKey(tenantId ?? ''),
    queryFn: async (): Promise<Capabilities | null> => {
      const { data } = await shell.api.GET('/clinic/capabilities');
      const limits = limitsOf(data);
      return data && limits ? { ...data, limits } : null;
    },
    enabled: typeof tenantId === 'string' && tenantId !== '',
    staleTime: 60_000,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** One limit of the clinic, once known. */
export function useLimit(tenantId: string | null | undefined, key: string): LimitUse | undefined {
  return useCapabilities(tenantId).data?.limits.find((l) => l.key === key);
}

/** The limit is counted and reached: its add is refused before sending. */
export const isFull = (limit: LimitUse | undefined): limit is LimitUse & { used: number } =>
  limit !== undefined && limit.used !== null && limit.used >= limit.limit;

export const PRACTITIONERS = 'limits.practitioners';
export const BRANCHES = 'limits.branches';

/** The `limitReached` of a 409 `limit_reached`, when present. */
export function limitReachedOf(
  error: unknown,
): { key: string; limit: number; used: number } | null {
  const body = error as { error?: { code?: unknown; limitReached?: unknown } } | null | undefined;
  if (body?.error?.code !== 'limit_reached') return null;
  const l = body.error.limitReached as { key?: unknown; limit?: unknown; used?: unknown } | null;
  if (typeof l?.key !== 'string' || typeof l.limit !== 'number' || typeof l.used !== 'number') {
    return { key: '', limit: 0, used: 0 };
  }
  return { key: l.key, limit: l.limit, used: l.used };
}
