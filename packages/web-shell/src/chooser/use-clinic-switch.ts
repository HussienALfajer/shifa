// The chooser's switch (slice A-01-07 checkpoint 4; the switch row of the slice's API table):
// POST /me/switch with the clinic (and the branch when the person picked one), then the session
// re-read and put in the cache, which the router sees as a new clinic: it drops every other cached
// query and goes home. The server's refusals become what the page shows: 403 `clinic_suspended`
// (the card turns suspended), 403 `branch_not_held` and 409 `branch_archived` (the list reloaded,
// an archived branch leaves it at once), 400 `branch_required` (the branch step), 404 (the list
// reloaded); no answer or a 5xx keeps the choice for «إعادة المحاولة». One switch at a time.
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { fetchSession, sessionQueryKey } from '../session.ts';

export type SwitchProblem = 'suspended' | 'notHeld' | 'archived' | 'gone' | 'network' | 'server';

interface Choice {
  tenantId: string;
  branchId: string | null;
}

export interface ClinicSwitchOptions {
  reload: () => void;
  askBranch: (tenantId: string) => void;
  backToClinics: () => void;
}

export function useClinicSwitch({ reload, askBranch, backToClinics }: ClinicSwitchOptions) {
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SwitchProblem | undefined>();
  const [suspended, setSuspended] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const last = useRef<Choice | null>(null);
  const running = useRef(false);

  const send = async (choice: Choice) => {
    if (running.current) return;
    running.current = true;
    last.current = choice;
    setBusy(true);
    setProblem(undefined);
    try {
      const body =
        choice.branchId === null
          ? { tenantId: choice.tenantId }
          : { tenantId: choice.tenantId, branchId: choice.branchId };
      const { data, error, response } = await shell.api.POST('/me/switch', { body });
      if (data) {
        const next = await fetchSession(shell);
        queryClient.setQueryData(sessionQueryKey, next);
        await navigate({ to: '/' });
        return;
      }
      const { code } = errorFacts(error);
      if (code === 'clinic_suspended') {
        setSuspended((s) => new Set([...s, choice.tenantId]));
        setProblem('suspended');
        backToClinics();
      } else if (code === 'branch_not_held') {
        setProblem('notHeld');
        reload();
      } else if (code === 'branch_archived') {
        const { branchId } = choice;
        if (branchId !== null) setGone((s) => new Set([...s, branchId]));
        setProblem('archived');
        reload();
      } else if (code === 'branch_required') {
        askBranch(choice.tenantId);
        reload();
      } else if (response.status === 404) {
        setProblem('gone');
        backToClinics();
        reload();
      } else {
        setProblem(response.status >= 500 ? 'server' : 'network');
      }
    } catch {
      setProblem('network');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return {
    busy,
    problem,
    suspended,
    gone,
    choose: (tenantId: string, branchId: string | null) => {
      void send({ tenantId, branchId });
    },
    retry: () => {
      if (last.current) void send(last.current);
    },
    clear: () => {
      setProblem(undefined);
    },
    backToClinics: () => {
      setProblem(undefined);
      backToClinics();
    },
  };
}
