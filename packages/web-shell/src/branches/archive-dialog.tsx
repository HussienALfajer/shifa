// «أرشفة» (slice A-01-08 checkpoint 4; prototype `Team08`; the archive-preview and archive rows
// of the slice's table; A-01b criteria 4, 9): the confirmation reads GET …/archive-preview and
// names the members whose sessions here end; the last active branch cannot be archived (the
// action disabled with the reason). 409 `last_branch` and no connection stay in it; 409
// `branch_archived` and 404 close it, named on the page, and the list is read again.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Button,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listOf } from '../chooser/chooser-text.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import type { Branch } from '../team/data.ts';
import { useText } from '../text.ts';
import type { PageNote } from './branch-note.tsx';

export function ArchiveDialog({
  tenantId,
  branch,
  onArchived,
  onRefused,
  onStale,
  onClose,
}: {
  tenantId: string;
  branch: Branch;
  onArchived: (archived: Branch) => Promise<void>;
  /** The branch is archived already or gone: the confirmation closes, the page names it. */
  onRefused: (note: PageNote) => void;
  /** Another branch was archived meanwhile: the page reads its list again (review N3). */
  onStale: () => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [failure, setFailure] = useState('');
  // The same refusal for the preview and the archive (review B1): archived already, or gone.
  const gone = (code: string, status: number): PageNote | null =>
    code === 'branch_archived'
      ? { tone: 'warning', title: text('branchArchived', { name: branch.name }) }
      : status === 404
        ? { tone: 'warning', title: text('branchGoneTitle'), text: text('branchGoneText') }
        : null;
  // Read on every opening: who is left without a branch changes with the team.
  const preview = useQuery({
    queryKey: ['clinic', tenantId, 'branches', 'archive-preview', branch.id],
    queryFn: async () => {
      const { data, error, response } = await shell.api.GET('/branches/{id}/archive-preview', {
        params: { path: { id: branch.id } },
      });
      if (data) return { ...data, refused: null };
      const refused = gone(errorFacts(error).code, response.status);
      if (refused) return { lastBranch: false, members: [], refused };
      throw new Error('GET archive-preview failed');
    },
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const refused = preview.data?.refused ?? null;
  const last = preview.data?.lastBranch === true;
  useEffect(() => {
    if (refused) onRefused(refused);
    else if (last) onStale();
    // Once per answer: the callbacks change with every render of the page.
  }, [refused, last]);

  async function archive() {
    setFailure(`${text('unreachableTitle')}. ${text('branchNetworkText')}`);
    const { data, error, response } = await shell.api.POST('/branches/{id}/archive', {
      params: { path: { id: branch.id } },
    });
    if (data) {
      await onArchived(data);
      return;
    }
    const { code } = errorFacts(error);
    const note = gone(code, response.status);
    if (note) {
      // Resolved: the confirmation closes; the page names it and reads the list again.
      onRefused(note);
      return;
    }
    if (code === 'last_branch') onStale();
    setFailure(code === 'last_branch' ? text('branchLastActive') : text('serverErrorText'));
    throw new Error(`archive answered ${String(response.status)}`);
  }

  const members = preview.data?.members ?? [];
  const body = preview.isPending ? (
    <SkeletonGroup label={text('branchArchiveReading')}>
      <SkeletonText lines={2} />
    </SkeletonGroup>
  ) : preview.isError ? (
    text('branchArchivePreviewFailed')
  ) : (
    <>
      {text('branchArchiveText')}{' '}
      {last
        ? text('branchLastActive')
        : members.length === 0
          ? text('branchArchiveNobody')
          : text('branchArchiveEnds', {
              count: members.length,
              names: listOf(members.map((m) => m.name)),
            })}
    </>
  );
  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent
        title={text('branchArchiveTitle', { name: branch.name })}
        description={body}
      >
        <AlertDialogCancel>{text('back')}</AlertDialogCancel>
        {preview.isError ? (
          <Button variant="secondary" onClick={() => void preview.refetch()}>
            {text('retry')}
          </Button>
        ) : preview.isPending || last ? (
          <Button variant="danger" disabled>
            {text('branchArchiveAction')}
          </Button>
        ) : (
          <AlertDialogAction errorText={failure} onAction={archive}>
            {text('branchArchiveAction')}
          </AlertDialogAction>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
