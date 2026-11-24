// The clinic chooser (slice A-01-07 checkpoint 4; prototype `Main`, approved 2026-11-24; A-01b
// criterion 10): `/choose` on clinic web, where the guard sends a finished session the server put
// in no clinic (several clinics, or roles in several branches of one). «أهلاً <name>، اختر
// العيادة», the clinics last used first (selectable before suspended), then the branch step where
// the person holds roles in two or more branches and none tenant-wide; the open invitations,
// answered on their own link (OD-91). A choice is POST /me/switch, then the session re-read: the
// router drops what was cached for no clinic and goes home. 404 `no_clinic`: the empty page.
import type { CommonKey } from '@shifa/i18n';
import { Button, Callout, EmptyState, Skeleton, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import logoReverse from '../../../../docs/brand/logo/shifa-logo-horizontal-reverse.svg';
import { CodesLeftNotice } from '../auth/codes-left-notice.tsx';
import { useMyName } from '../auth/me.ts';
import { SessionEndsNotice } from '../idle-dialog.tsx';
import { useShell } from '../providers.tsx';
import { useSession } from '../session.ts';
import { useText } from '../text.ts';
import { useSignOut } from '../use-sign-out.ts';
import {
  BranchCard,
  ClinicCard,
  InvitationCard,
  type MyClinic,
  type MyInvitation,
} from './chooser-cards.tsx';
import { ROLE_TEXT } from './chooser-text.ts';
import { type SwitchProblem, useClinicSwitch } from './use-clinic-switch.ts';

type Loaded = { kind: 'list'; clinics: MyClinic[]; invitations: MyInvitation[] } | { kind: 'none' };

class ClinicsLoadError extends Error {
  override name = 'ClinicsLoadError';
}

/** Roles in two or more branches and none tenant-wide: the branch step (A-01-09). */
export const needsBranch = (clinic: MyClinic) => !clinic.tenantWide && clinic.branches.length > 1;

function useMyClinics(userId: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: ['me', userId, 'clinics'],
    queryFn: async (): Promise<Loaded> => {
      const { data, response } = await shell.api.GET('/me/clinics');
      if (data) return { kind: 'list', clinics: data.clinics, invitations: data.invitations };
      if (response.status === 404) return { kind: 'none' };
      throw new ClinicsLoadError(`GET /me/clinics answered ${String(response.status)}`);
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

const PROBLEM: Record<
  SwitchProblem,
  {
    tone: 'warning' | 'danger';
    title: CommonKey;
    body: CommonKey;
    retry?: true;
  }
> = {
  suspended: { tone: 'warning', title: 'switchSuspendedTitle', body: 'switchSuspendedText' },
  notHeld: { tone: 'warning', title: 'switchBranchNotHeldTitle', body: 'switchBranchNotHeldText' },
  archived: {
    tone: 'warning',
    title: 'switchBranchArchivedTitle',
    body: 'switchBranchArchivedText',
  },
  gone: { tone: 'warning', title: 'switchGoneTitle', body: 'switchGoneText' },
  refused: { tone: 'warning', title: 'switchRefusedTitle', body: 'switchRefusedText' },
  network: { tone: 'danger', title: 'unreachableTitle', body: 'unreachableText', retry: true },
  server: { tone: 'danger', title: 'serverErrorTitle', body: 'serverErrorText', retry: true },
};

function ProblemCallout({ problem, onRetry }: { problem: SwitchProblem; onRetry: () => void }) {
  const text = useText();
  const look = PROBLEM[problem];
  return (
    <Callout
      data-testid="switch-problem"
      tone={look.tone}
      {...(problem === 'network' ? { icon: 'wifi-slash' as const } : {})}
      title={text(look.title)}
      {...(look.retry
        ? {
            action: (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {text('retry')}
              </Button>
            ),
          }
        : {})}
    >
      {text(look.body)}
    </Callout>
  );
}

function ChooserFrame({ name, children }: { name: string | undefined; children: ReactNode }) {
  const text = useText();
  const signOutNow = useSignOut();
  const appName = text('appName');
  return (
    <div className="flex min-h-dvh flex-col bg-bg-app font-ui text-text-default">
      <header className="flex items-center gap-3 border-b border-border-default bg-bg-surface px-4 py-3 md:px-6">
        <img src={logoColour} alt={appName} className="h-auto w-(--shifa-width-24) dark:hidden" />
        <img
          src={logoReverse}
          alt={appName}
          className="hidden h-auto w-(--shifa-width-24) dark:block"
        />
        <span className="flex-1" />
        {name !== undefined && <span className="text-body leading-body font-medium">{name}</span>}
        <Button size="sm" variant="ghost" startIcon="sign-out" onClick={signOutNow}>
          {text('signOutShort')}
        </Button>
      </header>
      <main className="flex flex-1 justify-center px-4 py-8 md:px-8 md:py-12">
        <div className="flex w-full flex-col gap-4 md:w-(--shifa-width-140)">{children}</div>
      </main>
    </div>
  );
}

function Loading() {
  const text = useText();
  return (
    <SkeletonGroup label={text('chooserLoading')}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="flex items-center gap-4 rounded-(--shifa-card-radius) bg-bg-surface p-(--shifa-card-padding)"
        >
          <Skeleton shape="circle" className="size-(--shifa-size-avatar-lg) shrink-0" />
          <SkeletonText lines={2} />
        </span>
      ))}
    </SkeletonGroup>
  );
}

export function ClinicChooserPage() {
  const { shell } = useShell();
  const state = useSession(shell);
  const userId = state?.kind === 'signed-in' ? state.session.userId : '';
  return userId === '' ? null : <Chooser key={userId} userId={userId} />;
}

function Chooser({ userId }: { userId: string }) {
  const text = useText();
  const name = useMyName(userId);
  const clinics = useMyClinics(userId);
  const signOutNow = useSignOut();
  const [branchOf, setBranchOf] = useState<string | null>(null);
  const flow = useClinicSwitch({
    reload: () => void clinics.refetch(),
    askBranch: (tenantId) => {
      setBranchOf(tenantId);
    },
    backToClinics: () => {
      setBranchOf(null);
    },
  });
  const [now] = useState(() => Date.now());

  if (clinics.isPending) {
    return (
      <ChooserFrame name={name}>
        <Loading />
      </ChooserFrame>
    );
  }
  if (clinics.isError) {
    return (
      <ChooserFrame name={name}>
        <Callout
          tone="danger"
          icon="wifi-slash"
          title={text('unreachableTitle')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void clinics.refetch()}>
              {text('retry')}
            </Button>
          }
        >
          {text('unreachableText')}
        </Callout>
      </ChooserFrame>
    );
  }
  if (clinics.data.kind === 'none') {
    return (
      <ChooserFrame name={name}>
        <EmptyState
          size="page"
          art="star"
          headingLevel={2}
          title={text('noClinicTitle')}
          description={text('noClinicText')}
          actions={
            <Button variant="secondary" startIcon="sign-out" onClick={signOutNow}>
              {text('signOutShort')}
            </Button>
          }
        />
      </ChooserFrame>
    );
  }

  const { invitations } = clinics.data;
  const list = clinics.data.clinics;
  const isOff = (c: MyClinic) => !c.selectable || flow.suspended.has(c.tenantId);
  const ordered = [...list.filter((c) => !isOff(c)), ...list.filter(isOff)];
  const choosing = branchOf === null ? undefined : list.find((c) => c.tenantId === branchOf);
  const problem =
    flow.problem === undefined ? null : (
      <ProblemCallout problem={flow.problem} onRetry={flow.retry} />
    );

  if (choosing) {
    const branches = choosing.branches.filter((b) => !flow.gone.has(b.id));
    // `MyBranch` carries no roles: the clinic's one role is true of every branch, several are not
    // (review finding 4; per-branch roles are an API gap in docs/backlog.md).
    const [only, ...more] = choosing.roles;
    const roles = only !== undefined && more.length === 0 ? text(ROLE_TEXT[only]) : undefined;
    return (
      <ChooserFrame name={name}>
        <div>
          <Button size="sm" variant="ghost" startIcon="arrow-back" onClick={flow.backToClinics}>
            {text('branchBack')}
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-heading-md leading-heading font-semibold">
            {text('branchTitle')}
          </h1>
          <p className="m-0 text-body leading-body text-text-muted">
            {text('branchText', { clinic: choosing.name })}
          </p>
        </div>
        {problem}
        {branches.map((b) => (
          <BranchCard
            key={b.id}
            branch={b}
            roles={roles}
            busy={flow.busy}
            onPick={() => {
              flow.choose(choosing.tenantId, b.id);
            }}
          />
        ))}
      </ChooserFrame>
    );
  }

  return (
    <ChooserFrame name={name}>
      <SessionEndsNotice />
      <CodesLeftNotice />
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-heading-md leading-heading font-semibold">
          {name === undefined ? text('chooserTitlePlain') : text('chooserTitle', { name })}
        </h1>
        <p className="m-0 text-body leading-body text-text-muted">
          {text(list.length === 0 ? 'chooserNoClinicYet' : 'chooserText')}
        </p>
      </div>
      {problem}
      {ordered.map((c) => (
        <ClinicCard
          key={c.tenantId}
          clinic={c}
          first={c === list[0]}
          suspended={isOff(c)}
          busy={flow.busy}
          now={now}
          onPick={() => {
            if (needsBranch(c)) {
              flow.clear();
              setBranchOf(c.tenantId);
              return;
            }
            flow.choose(c.tenantId, null);
          }}
        />
      ))}
      {invitations.length > 0 && (
        <>
          <p className="m-0 mt-2 text-caption leading-body font-medium text-text-muted">
            {text('chooserInvitesTitle')}
          </p>
          {invitations.map((i) => (
            <InvitationCard key={i.id} invitation={i} />
          ))}
        </>
      )}
    </ChooserFrame>
  );
}
