// The member drawer's form (slice A-01-08 checkpoint 3; prototype `Team08`; the `PATCH
// /team/members/:id` row of the slice's table): the name (any member, OD-103), the roles with
// scope and the sensitive toggles. «حفظ» waits for a change (improvement d) and sends only what
// changed; removing every role is confirmed first (the person leaves this clinic). `last_owner`,
// `owner_role_protected`, `branch_archived` and no connection keep the choices; a 404 says the
// person left the team. A-02-10: the doctors' limit on the roles and a 409 `limit_reached`
// named; in a support session «حفظ» is disabled with «للقراءة فقط».
import type { CommonKey } from '@shifa/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Button,
  DrawerActions,
  Input,
} from '@shifa/ui';
import { type ReactNode, useState } from 'react';
import { useSignedIn } from '../account/data.ts';
import { limitReachedOf } from '../capabilities.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { ReadOnlyNote, useReadOnly } from '../support/support-banner.tsx';
import { useText } from '../text.ts';
import { type Branch, type MemberDetail, NAME_MAX } from './data.ts';
import { LimitRefused, useDoctorLimit } from './limit-parts.tsx';
import { GONE, type Note } from './member-account.tsx';
import {
  defaultOf,
  type KeyDefault,
  PermissionsField,
  type SwitchDraft,
} from './permissions-field.tsx';
import { draftOf, RolesField, rolesProblem, sameRoles, toRoles } from './roles-field.tsx';

const REFUSED: Record<string, Note> = {
  last_owner: { tone: 'danger', title: 'memberLastOwnerTitle', text: 'memberLastOwnerText' },
  owner_role_protected: {
    tone: 'danger',
    title: 'memberOwnerProtectedTitle',
    text: 'memberOwnerProtectedText',
  },
  branch_archived: {
    tone: 'warning',
    title: 'memberBranchArchivedTitle',
    text: 'memberBranchArchivedText',
  },
};

const NETWORK: Note = { tone: 'danger', title: 'memberNetworkTitle', text: 'memberNetworkText' };
const SERVER: Note = { tone: 'danger', title: 'memberNotSavedTitle', text: 'serverErrorText' };

const switchesOf = (member: MemberDetail): SwitchDraft =>
  Object.fromEntries(member.permissions.map((p) => [p.key, p.overridden ? p.granted : null]));

export function MemberForm({
  member,
  branches,
  scoped,
  catalogue,
  onSaved,
  onNote,
  rereadBranches,
  reread,
  children,
}: {
  member: MemberDetail;
  branches: readonly Branch[];
  scoped: boolean;
  catalogue: readonly KeyDefault[];
  onSaved: (next: MemberDetail) => void;
  onNote: (note: Note | null) => void;
  rereadBranches: () => void;
  /** Reads the member and the list again. */
  reread: () => void;
  /** The account part, between the toggles and «حفظ». */
  children?: ReactNode;
}) {
  const text = useText();
  const { shell } = useShell();
  const saved = draftOf(member.roles);
  const savedSwitches = switchesOf(member);
  const [name, setName] = useState(member.name);
  const [roles, setRoles] = useState(saved);
  const [switches, setSwitches] = useState(savedSwitches);
  const [problem, setProblem] = useState<{ name: boolean; roles: CommonKey | null }>({
    name: false,
    roles: null,
  });
  const [busy, setBusy] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [limitRefused, setLimitRefused] = useState<ReturnType<typeof limitReachedOf>>(null);
  const readOnly = useReadOnly();
  const doctorLimit = useDoctorLimit(useSignedIn()?.tenantId ?? '');

  const nameChanged = name.trim() !== member.name;
  const rolesChanged = !sameRoles(roles, saved);
  // A switch that now equals the default of the roles in the form, on a key that followed the
  // default, keeps following it: stored, it would stay off or on after a later role change while
  // the form calls it the default (review, non-blocking 2).
  const effective = (key: string) => {
    const own = switches[key] ?? null;
    return own !== null &&
      (savedSwitches[key] ?? null) === null &&
      own === defaultOf(catalogue, key, roles)
      ? null
      : own;
  };
  const changedSwitches = Object.keys(switches).flatMap((key) =>
    effective(key) === (savedSwitches[key] ?? null) ? [] : [{ key, granted: effective(key) }],
  );
  const archivedNames = Object.fromEntries(
    member.roles.flatMap((r) =>
      r.branchId !== null && !branches.some((b) => b.id === r.branchId)
        ? [[r.branchId, r.branchName ?? '']]
        : [],
    ),
  );
  const changed = nameChanged || rolesChanged || changedSwitches.length > 0;
  const emptied = rolesChanged && toRoles(roles).length === 0;

  async function send() {
    setBusy(true);
    onNote(null);
    setLimitRefused(null);
    try {
      const { data, error, response } = await shell.api.PATCH('/team/members/{id}', {
        params: { path: { id: member.id } },
        body: {
          ...(nameChanged ? { name: name.trim() } : {}),
          ...(rolesChanged ? { roles: toRoles(roles) } : {}),
          ...(changedSwitches.length > 0 ? { permissions: changedSwitches } : {}),
        },
      });
      if (data) {
        onSaved(data);
        onNote({ tone: 'success', title: 'memberSaved', text: 'memberSavedText' });
        return;
      }
      const reached = limitReachedOf(error);
      if (reached) {
        setLimitRefused(reached);
        return;
      }
      const { code } = errorFacts(error);
      if (code === 'branch_archived') rereadBranches();
      if (response.status === 404) reread();
      // A held archived-branch role goes back with the save (OD-107, A-01-13); a 409
      // `branch_archived` now means a chosen branch was archived meanwhile.
      onNote(response.status === 404 ? GONE : (REFUSED[code] ?? SERVER));
    } catch {
      onNote(NETWORK);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const next = {
      name: name.trim() === '',
      roles: emptied ? null : rolesChanged ? rolesProblem(roles, scoped) : null,
    };
    setProblem(next);
    if (next.name || next.roles !== null || !changed) return;
    if (emptied) {
      setConfirmEmpty(true);
      return;
    }
    void send();
  }

  return (
    <>
      <Input
        label={text('memberName')}
        maxLength={NAME_MAX}
        value={name}
        onValueChange={(v) => {
          setName(v);
          setProblem((p) => ({ ...p, name: false }));
        }}
        error={problem.name ? text('memberNameMissing') : undefined}
      />
      <RolesField
        draft={roles}
        onChange={(next) => {
          setRoles(next);
          setProblem((p) => ({ ...p, roles: null }));
        }}
        branches={branches}
        scoped={scoped}
        lockedOwner={member.isLastOwner}
        archivedNames={archivedNames}
        problem={problem.roles}
        doctorLimit={doctorLimit}
        heldDoctor={
          member.status !== 'deactivated' && member.roles.some((r) => r.role === 'doctor')
        }
      />
      <LimitRefused reached={limitRefused} />
      <PermissionsField
        keys={member.permissions.map((p) => p.key)}
        catalogue={catalogue}
        roles={roles}
        draft={switches}
        onChange={setSwitches}
      />
      {children}
      <DrawerActions>
        <Button variant="primary" loading={busy} disabled={readOnly || !changed} onClick={save}>
          {text('save')}
        </Button>
        {readOnly && <ReadOnlyNote />}
      </DrawerActions>
      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        {confirmEmpty && (
          <AlertDialogContent
            tone="danger"
            title={text('memberRemoveAllTitle', { name: member.name })}
            description={text('memberRemoveAllText')}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction onAction={send}>{text('memberRemoveAllAction')}</AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
