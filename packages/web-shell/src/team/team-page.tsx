// «الفريق» (slice A-01-08 checkpoint 3; prototype `Team08`, approved 2026-11-24; A-01b criteria
// 2–3, PLT-05, PLT-06), the clinic's owner only: GET /team/members in the @shifa/ui DataTable (a
// card per member on a phone). Search by name or phone in the page (small teams, no paging); the
// status filter with counts (improvement a); `?branch=` from a branch card shows that branch's
// team (e). States: loading, the owner alone (empty), no match, no connection. The name opens the
// member drawer; «إضافة موظف» opens it to add. A member who is not the owner is sent to My account.
import type { CommonKey } from '@shifa/i18n';
import {
  Button,
  DataTable,
  EmptyState,
  foldArabic,
  Input,
  SegmentedControl,
  SkeletonGroup,
  SkeletonText,
  toWesternDigits,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { AppFrame } from '../account/app-frame.tsx';
import { isOwner, useActiveClinic, useSignedIn } from '../account/data.ts';
import { LoadFailed } from '../account/load-failed.tsx';
import { useIsPhone } from '../auth/media.ts';
import type { TeamSearch } from '../router.tsx';
import { ReadOnlyNote, useReadOnly } from '../support/support-banner.tsx';
import { useText } from '../text.ts';
import {
  type MemberStatus,
  type MemberSummary,
  NAME_MAX,
  STATUSES,
  teamKey,
  useBranches,
  usePermissionDefaults,
  useTeam,
} from './data.ts';
import { type DrawerTarget, TeamDrawer } from './member-drawer.tsx';
import type { TeamContext } from './panel.tsx';
import { MemberCard, useTeamColumns } from './team-rows.tsx';

type Filter = 'all' | MemberStatus;

const FILTER_WORD = {
  active: 'teamFilterActive',
  pending: 'teamFilterPending',
  deactivated: 'teamFilterDeactivated',
} as const satisfies Record<MemberStatus, CommonKey>;

/** Digits only, Western: «+963 944…» and «0944…» both find a phone by its last digits. */
const digitsOf = (s: string) => toWesternDigits(s).replace(/\D/g, '');

function matches(m: MemberSummary, typed: string): boolean {
  const q = typed.trim();
  if (q === '') return true;
  if (foldArabic(m.name).includes(foldArabic(q))) return true;
  const digits = digitsOf(q);
  return digits.length >= 3 && digitsOf(m.phone).includes(digits);
}

function Team({
  tenantId,
  clinicName,
  solo,
  known,
}: {
  tenantId: string;
  clinicName?: string;
  solo: boolean;
  /** GET /me/clinics answered: whether the clinic is solo is known. */
  known: boolean;
}) {
  const text = useText();
  const readOnly = useReadOnly();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const search: TeamSearch = useSearch({ strict: false });
  const { branch } = search;
  const { data, isError, isPending, refetch } = useTeam(tenantId);
  const branches = useBranches(tenantId);
  const defaults = usePermissionDefaults(tenantId);
  const [typed, setTyped] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const active = branches.data ?? [];
  const team: TeamContext = {
    tenantId,
    branches: active,
    scoped: !solo && active.length >= 2,
    catalogue: defaults.data,
    // Branches unknown is not "no scope": a role would go out clinic-wide (review B3).
    ready: known && (solo || branches.isSuccess) && defaults.isSuccess,
    failed: branches.isError || defaults.isError,
    retry: () => {
      if (branches.isError) void branches.refetch();
      if (defaults.isError) void defaults.refetch();
    },
    rereadBranches: () => void branches.refetch(),
  };
  const open = (id: string) => {
    setTarget({ kind: 'member', id });
  };
  const columns = useTeamColumns(open, team.scoped);
  const onlyBranch = branch === undefined ? undefined : active.find((b) => b.id === branch);
  const all = (data ?? []).filter(
    (m) => onlyBranch === undefined || m.roles.some((r) => r.branchId === onlyBranch.id),
  );
  const count = (s: MemberStatus) => all.filter((m) => m.status === s).length;
  const rows = all.filter((m) => (filter === 'all' || m.status === filter) && matches(m, typed));
  const alone = data?.every((m) => m.isSelf) === true;
  const addButton = (
    <Button
      variant="primary"
      startIcon="plus"
      disabled={readOnly}
      onClick={() => {
        setTarget({ kind: 'add' });
      }}
    >
      {text('teamAdd')}
    </Button>
  );
  // A support session reads the team; every write is drawn disabled (A-02-10).
  const add = readOnly ? (
    <span className="flex flex-col items-end gap-1">
      {addButton}
      <ReadOnlyNote />
    </span>
  ) : (
    addButton
  );
  const toolbar = (
    <div className="flex flex-1 flex-wrap items-center gap-3">
      <Input
        type="search"
        aria-label={text('teamSearch')}
        maxLength={NAME_MAX}
        placeholder={text('teamSearch')}
        startIcon="magnifying-glass"
        value={typed}
        onValueChange={setTyped}
        className="max-w-(--shifa-width-80) flex-1"
      />
      <SegmentedControl
        aria-label={text('teamFilter')}
        value={filter}
        onValueChange={(next) => {
          setFilter(next as Filter);
        }}
        items={[
          { value: 'all', label: text('teamFilterAll', { count: all.length }) },
          ...STATUSES.map((s) => ({ value: s, label: text(FILTER_WORD[s], { count: count(s) }) })),
        ]}
      />
      <span className="flex-1" />
      {add}
    </div>
  );
  // Under the page's h1, or under the branch filter's h2 (axe heading-order, checkpoint 5).
  const headingLevel = onlyBranch === undefined ? (2 as const) : (3 as const);
  const empty =
    typed.trim() === ''
      ? { title: text('teamNoneInStatus'), icon: 'magnifying-glass' as const, headingLevel }
      : {
          title: text('teamNoMatchTitle'),
          description: text('teamNoMatchText'),
          icon: 'magnifying-glass' as const,
          headingLevel,
        };
  return (
    <AppFrame
      current="team"
      title={text('teamTitle')}
      description={
        clinicName === undefined ? text('teamTextPlain') : text('teamText', { clinic: clinicName })
      }
    >
      {onlyBranch && (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="m-0 text-heading-sm leading-heading font-semibold">
            {text('teamBranchOnly', { branch: onlyBranch.name })}
          </h2>
          <Button
            size="sm"
            variant="secondary"
            startIcon="users"
            onClick={() => void navigate({ to: '/team', search: {} })}
          >
            {text('teamBranchClear')}
          </Button>
        </div>
      )}
      {isError && !data ? (
        <LoadFailed retry={refetch} />
      ) : alone && onlyBranch === undefined ? (
        <EmptyState
          title={text('teamEmptyTitle')}
          description={text('teamEmptyText')}
          headingLevel={2}
          actions={add}
        />
      ) : phone ? (
        <div className="flex flex-col gap-3">
          {toolbar}
          {isPending ? (
            <SkeletonGroup label={text('teamLoading')}>
              <SkeletonText lines={6} />
            </SkeletonGroup>
          ) : rows.length === 0 ? (
            <EmptyState size="panel" {...empty} />
          ) : (
            <div role="list" aria-label={text('teamTitle')} className="flex flex-col gap-3">
              {rows.map((m) => (
                <MemberCard key={m.id} m={m} scoped={team.scoped} onOpen={open} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <DataTable
          aria-label={text('teamTitle')}
          columns={columns}
          rows={rows}
          getRowId={(m) => m.id}
          loading={isPending}
          loadingRows={5}
          empty={empty}
          toolbar={toolbar}
        />
      )}
      {target && (
        <TeamDrawer
          team={team}
          target={target}
          onTarget={setTarget}
          onClose={() => {
            setTarget(null);
            // A member reopened later is read again: the person may have accepted, set up TOTP
            // or been changed meanwhile, and the drawer offers actions by what it last read
            // (review B1).
            queryClient.removeQueries({ queryKey: [...teamKey(tenantId), 'member'] });
            void queryClient.invalidateQueries({
              queryKey: teamKey(tenantId),
              exact: true,
            });
          }}
        />
      )}
    </AppFrame>
  );
}

export function TeamPage() {
  const session = useSignedIn();
  const clinic = useActiveClinic(session);
  if (!session) return null;
  if (!isOwner(session) || session.tenantId === null) return <Navigate to="/account" replace />;
  return (
    <Team
      tenantId={session.tenantId}
      {...(clinic ? { clinicName: clinic.name } : {})}
      solo={clinic?.solo === true}
      known={clinic !== undefined}
    />
  );
}
