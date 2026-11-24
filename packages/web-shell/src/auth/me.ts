// The signed-in person's name (GET /me, allowed before MFA too, A-01-09): the challenge greets
// them and the recovery codes' print sheet names them. Keyed by the person, so another person's
// name never shows; never retried by itself (every request is activity to the server).
import { useQuery } from '@tanstack/react-query';
import { useShell } from '../providers.tsx';

export function useMyName(userId: string): string | undefined {
  const { shell } = useShell();
  const { data } = useQuery({
    queryKey: ['me', userId],
    queryFn: async () => {
      const { data: me } = await shell.api.GET('/me');
      // The cookie may belong to someone else by now (another tab): only this person's name.
      return me?.userId === userId ? me : null;
    },
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data?.name;
}
