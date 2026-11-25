// The role assignments of a member (slice A-01-08 checkpoint 3; prototype `Team08`; PLT-42,
// PLT-45): one checkbox per role and, in a clinic with two branches or more, the branches it is
// held in or «كل الفروع». The owner role is always clinic-wide; the last owner's own is locked
// with the reason. A solo clinic (one branch) shows no scope: a new role is clinic-wide and a held
// one keeps its branch. The draft lives with the caller; `toRoles()` is what the server receives.
import type { CommonKey } from '@shifa/i18n';
import { Checkbox, cn, Icon } from '@shifa/ui';
import { useText } from '../text.ts';
import { type Branch, ROLE_WORD, ROLES, type Role, type RoleScope } from './data.ts';

export interface RoleDraft {
  on: boolean;
  /** Held in every branch (`branchId` null). */
  all: boolean;
  branches: string[];
}
export type RolesDraft = Record<Role, RoleDraft>;

export function draftOf(roles: readonly { role: Role; branchId: string | null }[]): RolesDraft {
  const draft = {} as RolesDraft;
  for (const role of ROLES) {
    const held = roles.filter((r) => r.role === role);
    draft[role] = {
      on: held.length > 0,
      all: held.some((r) => r.branchId === null),
      branches: held.flatMap((r) => (r.branchId === null ? [] : [r.branchId])),
    };
  }
  return draft;
}

/** The full list the server takes, in the order of ROLES and of the branches as chosen. */
export function toRoles(draft: RolesDraft): RoleScope[] {
  return ROLES.flatMap((role): RoleScope[] => {
    const d = draft[role];
    if (!d.on) return [];
    // Without branches chosen (a solo clinic's new role) the role is clinic-wide.
    if (role === 'owner' || d.all || d.branches.length === 0) return [{ role, branchId: null }];
    return d.branches.map((branchId) => ({ role, branchId }));
  });
}

/** What is missing before sending: no role, or a role without its branches. */
export function rolesProblem(draft: RolesDraft, scoped: boolean): CommonKey | null {
  const on = ROLES.filter((r) => draft[r].on);
  if (on.length === 0) return 'memberRolesMissing';
  if (scoped && on.some((r) => r !== 'owner' && !draft[r].all && draft[r].branches.length === 0)) {
    return 'memberScopeMissing';
  }
  return null;
}

export const sameRoles = (a: RolesDraft, b: RolesDraft) =>
  JSON.stringify(toRoles(a)) === JSON.stringify(toRoles(b));

export function RolesField({
  draft,
  onChange,
  branches,
  scoped,
  lockedOwner,
  problem,
}: {
  draft: RolesDraft;
  onChange: (next: RolesDraft) => void;
  branches: readonly Branch[];
  /** Two active branches or more: each role names its branches. */
  scoped: boolean;
  /** The clinic's last active owner: the owner role cannot be removed. */
  lockedOwner: boolean;
  /** Shown only once a send was refused before leaving the page. */
  problem: CommonKey | null;
}) {
  const text = useText();
  const set = (role: Role, next: Partial<RoleDraft>) => {
    onChange({ ...draft, [role]: { ...draft[role], ...next } });
  };
  const toggleBranch = (role: Role, id: string, on: boolean) => {
    const now = draft[role].branches.filter((b) => b !== id);
    set(role, { branches: on ? [...now, id] : now });
  };
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-body leading-heading font-semibold">
        {text('memberRoles')}
      </legend>
      <p className="m-0 text-caption leading-body text-text-muted">{text('memberRolesHint')}</p>
      {ROLES.map((role) => {
        const d = draft[role];
        const owner = role === 'owner';
        const missing =
          problem === 'memberScopeMissing' && d.on && !owner && !d.all && d.branches.length === 0;
        return (
          <div key={role} data-testid={`role-${role}`} className="flex flex-col">
            <Checkbox
              checked={d.on}
              disabled={owner && lockedOwner}
              onCheckedChange={(on) => {
                set(role, on ? { on, all: owner || d.all } : { on });
              }}
              description={
                owner && lockedOwner
                  ? text('memberLastOwner')
                  : owner && d.on
                    ? text('memberOwnerScope')
                    : undefined
              }
            >
              {text(ROLE_WORD[role])}
            </Checkbox>
            {scoped && d.on && !owner && (
              <div
                role="group"
                aria-label={text('memberScopeLabel', { role: text(ROLE_WORD[role]) })}
                className={cn(
                  'ms-7 flex flex-wrap gap-x-5 border-s border-border-default ps-3',
                  missing && 'border-status-danger-fg',
                )}
              >
                <Checkbox
                  checked={d.all}
                  onCheckedChange={(all) => {
                    set(role, { all });
                  }}
                >
                  {text('teamAllBranches')}
                </Checkbox>
                {branches.map((b) => (
                  <Checkbox
                    key={b.id}
                    checked={d.all || d.branches.includes(b.id)}
                    disabled={d.all}
                    onCheckedChange={(on) => {
                      toggleBranch(role, b.id, on);
                    }}
                  >
                    {b.name}
                  </Checkbox>
                ))}
              </div>
            )}
            {missing && <ProblemLine text={text('memberScopeMissing')} />}
          </div>
        );
      })}
      {problem === 'memberRolesMissing' && <ProblemLine text={text('memberRolesMissing')} />}
    </fieldset>
  );
}

export function ProblemLine({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="m-0 flex items-center gap-1 text-caption leading-body text-status-danger-fg"
    >
      <Icon name="warning" />
      {text}
    </p>
  );
}
