// «الفروع» (slice A-01-08 checkpoint 4; prototype `Team08`, approved 2026-11-24; A-01b criterion
// 9, PLT-03, PLT-04), the clinic's owner only: GET /branches as a card per active branch (name,
// address, phone left to right, the member count without clinic-wide roles, said once), with
// «عرض فريقه» to `/team?branch=` (improvement e), «تعديل» and «أرشفة» (the last active branch's
// disabled with the reason); the archived list with its date and «استعادة» (OD-105). States:
// loading, no connection. A solo clinic has no branch screens: the address goes to the clinic's
// settings, whose «الفروع» card adds the second branch (f) — unless archived branches wait for a
// restore. Archiving down to one keeps the page (the last-branch state); the menu then drops it.
// A-02-10 (boards `A02cLimits`, `A02cBranchPlace`): each card's city and area; at the branches'
// limit «إضافة فرع» is disabled with the Callout and a refused restore names the branch; a
// support session draws every write disabled with «للقراءة فقط».
import { Button, Callout, Card, IconButton, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { AppFrame } from '../account/app-frame.tsx';
import { clinicsKey, isOwner, useActiveClinic, useSignedIn } from '../account/data.ts';
import { LoadFailed } from '../account/load-failed.tsx';
import { dayDate } from '../auth/dates.ts';
import { BRANCHES, isFull, limitReachedOf, useLimit } from '../capabilities.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { ReadOnlyNote, useReadOnly } from '../support/support-banner.tsx';
import { type Branch, branchesKey, teamKey, useBranchList } from '../team/data.ts';
import { useLimitSentence } from '../team/limit-parts.tsx';
import { useText } from '../text.ts';
import { ArchiveDialog } from './archive-dialog.tsx';
import { BranchDialog } from './branch-dialog.tsx';
import { BranchNote, type PageNote } from './branch-note.tsx';
import { BranchPlaceLine } from './place-fields.tsx';

type Target =
  | { kind: 'add' }
  | { kind: 'edit'; branch: Branch }
  | { kind: 'archive'; branch: Branch };

/** After any branch change: the list, the team (counts, scopes) and the clinics (switcher, menu). */
export function useBranchesChanged(tenantId: string, userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: branchesKey(tenantId) }),
      queryClient.invalidateQueries({ queryKey: teamKey(tenantId) }),
      queryClient.invalidateQueries({ queryKey: clinicsKey(userId) }),
    ]);
}

function BranchCard({
  branch,
  last,
  onEdit,
  onArchive,
}: {
  branch: Branch;
  last: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const text = useText();
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const reasonId = useId();
  const titleId = useId();
  return (
    // A group named by the branch: its buttons share names across cards (review N5).
    <div data-testid="branch-card" role="group" aria-labelledby={titleId}>
      <Card className="h-full gap-3 p-(--shifa-card-padding)">
        <div className="flex items-start gap-2">
          <h2
            id={titleId}
            className="m-0 min-w-0 flex-1 text-heading-sm leading-heading font-semibold"
          >
            {branch.name}
          </h2>
          <IconButton
            icon="pencil"
            label={text('branchEdit')}
            variant="ghost"
            disabled={readOnly}
            onClick={onEdit}
          />
        </div>
        <BranchPlaceLine branch={branch} />
        <p className="m-0 text-data leading-body text-text-muted">
          {branch.address ?? text('branchNoAddress')}
        </p>
        {branch.phone !== null && (
          <p className="m-0 text-data leading-body">
            <bdi dir="ltr">{branch.phone}</bdi>
          </p>
        )}
        <p className="m-0 text-data leading-body">
          {text('branchMembers', { count: branch.memberCount })}
        </p>
        {last && (
          <p id={reasonId} className="m-0 text-caption leading-body text-text-muted">
            {text('branchLastActive')}
          </p>
        )}
        <span className="flex-1" />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            startIcon="users"
            onClick={() => void navigate({ to: '/team', search: { branch: branch.id } })}
          >
            {text('branchShowTeam')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            startIcon="archive"
            disabled={readOnly || last}
            {...(last ? { 'aria-describedby': reasonId } : {})}
            onClick={onArchive}
          >
            {text('branchArchive')}
          </Button>
          {readOnly && <ReadOnlyNote />}
        </div>
      </Card>
    </div>
  );
}

function ArchivedRow({
  branch,
  onRestore,
}: {
  branch: Branch;
  onRestore: (b: Branch) => Promise<void>;
}) {
  const text = useText();
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(false);
  return (
    <li
      data-testid="branch-archived"
      className="flex flex-wrap items-center gap-3 border-b border-border-default py-3 last:border-b-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{branch.name}</span>
        {branch.archivedAt !== null && (
          <span className="block text-caption leading-body text-text-muted">
            {text('branchArchivedOn', { date: dayDate(Date.parse(branch.archivedAt)) })}
          </span>
        )}
      </span>
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        disabled={readOnly}
        onClick={() => {
          setBusy(true);
          void onRestore(branch).finally(() => {
            setBusy(false);
          });
        }}
      >
        {text('branchRestore')}
      </Button>
    </li>
  );
}

function Branches({
  tenantId,
  userId,
  clinicName,
}: {
  tenantId: string;
  userId: string;
  clinicName?: string;
}) {
  const text = useText();
  const { shell } = useShell();
  const { data, isError, isPending, refetch } = useBranchList(tenantId);
  const changed = useBranchesChanged(tenantId, userId);
  const [target, setTarget] = useState<Target | null>(null);
  const [note, setNote] = useState<PageNote | null>(null);
  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const readOnly = useReadOnly();
  const sentence = useLimitSentence();
  const branchLimit = useLimit(tenantId, BRANCHES);
  const full = isFull(branchLimit);

  const refused = (next: PageNote) => {
    setTarget(null);
    setNote(next);
    void changed();
  };

  async function answerOf(branch: Branch): Promise<PageNote> {
    try {
      const {
        data: back,
        error,
        response,
      } = await shell.api.POST('/branches/{id}/restore', {
        params: { path: { id: branch.id } },
      });
      if (back) return { tone: 'success', title: text('branchRestored', { name: back.name }) };
      const reached = limitReachedOf(error);
      if (reached) {
        return {
          tone: 'danger',
          title: text('limitRestoreRefused', { name: branch.name }),
          text: sentence(reached),
        };
      }
      if (errorFacts(error).code === 'branch_not_archived') {
        return {
          tone: 'warning',
          title: text('branchNotArchivedTitle'),
          text: text('branchNotArchivedText'),
        };
      }
      if (response.status === 404) {
        return { tone: 'warning', title: text('branchGoneTitle'), text: text('branchGoneText') };
      }
      return { tone: 'danger', title: text('actionFailedTitle'), text: text('serverErrorText') };
    } catch {
      return { tone: 'danger', title: text('unreachableTitle'), text: text('branchNetworkText') };
    }
  }

  async function restore(branch: Branch) {
    setNote(null);
    const answer = await answerOf(branch);
    // The row stays busy until the list is read again, so it is not pressed twice (review N2).
    await changed().catch(() => undefined);
    setNote(answer);
  }

  const add = (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        startIcon="plus"
        disabled={readOnly || full}
        onClick={() => {
          setNote(null);
          setTarget({ kind: 'add' });
        }}
      >
        {text('branchesAdd')}
      </Button>
      {readOnly && <ReadOnlyNote />}
    </span>
  );
  return (
    <AppFrame
      current="branches"
      title={text('branchesTitle')}
      description={
        clinicName === undefined
          ? text('branchesTextPlain')
          : text('branchesText', { clinic: clinicName })
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 flex-1 text-caption leading-body text-text-muted">
          {text('branchesCountNote')}
        </p>
        {add}
      </div>
      {full && (
        <Callout
          tone="info"
          title={text('limitBranchesFullTitle', {
            used: branchLimit.used,
            limit: branchLimit.limit,
          })}
        >
          {text('limitBranchesFullText')}
        </Callout>
      )}
      <BranchNote note={note} />
      {isError && !data ? (
        <LoadFailed retry={refetch} />
      ) : isPending ? (
        <SkeletonGroup label={text('branchesLoading')}>
          <SkeletonText lines={6} />
        </SkeletonGroup>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((b) => (
              <BranchCard
                key={b.id}
                branch={b}
                last={active.length === 1}
                onEdit={() => {
                  setNote(null);
                  setTarget({ kind: 'edit', branch: b });
                }}
                onArchive={() => {
                  setNote(null);
                  setTarget({ kind: 'archive', branch: b });
                }}
              />
            ))}
          </div>
          {archived.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-heading-sm leading-heading font-semibold">
                {text('branchesArchivedTitle')}
              </h2>
              <ul className="m-0 list-none rounded-surface border border-border-default bg-bg-surface px-4">
                {archived.map((b) => (
                  <ArchivedRow key={b.id} branch={b} onRestore={restore} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {target?.kind === 'archive' ? (
        <ArchiveDialog
          tenantId={tenantId}
          branch={target.branch}
          onArchived={async (b) => {
            // The confirmation stays busy until the list is read again (review N2).
            await changed().catch(() => undefined);
            setTarget(null);
            setNote({ tone: 'success', title: text('branchArchived', { name: b.name }) });
          }}
          onRefused={refused}
          onStale={() => void changed()}
          onClose={() => {
            setTarget(null);
          }}
        />
      ) : target ? (
        <BranchDialog
          {...(target.kind === 'edit' ? { branch: target.branch } : {})}
          onSaved={(b, added) => {
            setTarget(null);
            setNote({
              tone: 'success',
              title: text(added ? 'branchAdded' : 'branchSaved', { name: b.name }),
            });
            void changed();
          }}
          onRefused={refused}
          onClose={() => {
            setTarget(null);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

export function BranchesPage() {
  const session = useSignedIn();
  const clinic = useActiveClinic(session);
  // Read for the owner of a clinic only (review N6).
  const list = useBranchList(session?.tenantId ?? '', isOwner(session) && !!session?.tenantId);
  // Whether the clinic is solo is taken once, on entry: archiving down to one branch while here
  // keeps the page with its last-branch state (spec gap 2); only the menu drops it. The fresh
  // list counts too: clinics read before a branch was added still say solo (review N8).
  const soloOnEntry = useRef<boolean | null>(null);
  if (soloOnEntry.current === null && clinic !== undefined && list.data !== undefined) {
    soloOnEntry.current =
      clinic.solo && list.data.active.length <= 1 && list.data.archived.length === 0;
  }
  if (!session) return null;
  if (!isOwner(session) || session.tenantId === null) return <Navigate to="/account" replace />;
  if (soloOnEntry.current === true) return <Navigate to="/settings" replace />;
  return (
    <Branches
      tenantId={session.tenantId}
      userId={session.userId}
      {...(clinic ? { clinicName: clinic.name } : {})}
    />
  );
}
