// The header switcher (slice A-01-08 checkpoint 2), as the owner approved it on 2026-11-24
// ("Shifa Screens · Clinic web", page "A-01-08 Team batch", prototype `Team08`, sheet
// `MenuGroupsSheet`; A-01b criterion 11). The button names the clinic and the branch (the clinic
// alone on a phone); the menu lists the person's clinics (role, scope, last activity; a suspended
// one disabled with the reason), the branches of the current clinic («كل الفروع» first for a
// tenant-wide role) and, for information, the invitations waiting on their link (improvement g).
// A clinic where the person holds roles in two or more branches and none tenant-wide asks for
// the branch inside the menu. Choosing calls POST /me/switch (use-clinic-switch.ts): the menu stays
// open with a spinner on the row until the server answers, then the session is re-read, the router
// drops the previous clinic's cache and goes home, and a toast says «أنت الآن في …» (improvement
// c). A refusal is a Callout inside the menu. On a phone the same rows rise in a bottom sheet. One
// clinic with one branch and no invitation: no switcher, the clinic named as text.
//
// A menu may hold only items (axe): the drawn Callout is hidden from screen readers and the same
// words are announced from a live region outside the menu (owner, 2026-11-24, as for the sheet's
// header).
import type { CommonKey } from '@shifa/i18n';
import {
  Callout,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuNote,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  useToast,
} from '@shifa/ui';
import { useState } from 'react';
import { type MyClinic, useMyClinics } from '../account/data.ts';
import { useIsPhone } from '../auth/media.ts';
import { lastActive, listOf, ROLE_TEXT } from '../chooser/chooser-text.ts';
import { type SwitchProblem, useClinicSwitch } from '../chooser/use-clinic-switch.ts';
import type { SessionView } from '../session.ts';
import { useText } from '../text.ts';

/** The radio value of «كل الفروع» (no branch chosen, a tenant-wide role). */
const ALL = 'all';

export const PROBLEM: Record<
  SwitchProblem,
  { tone: 'warning' | 'danger'; title: CommonKey; body: CommonKey }
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
  network: { tone: 'danger', title: 'switchNetworkTitle', body: 'switchNetworkText' },
  server: { tone: 'danger', title: 'serverErrorTitle', body: 'serverErrorText' },
};

/** Roles in two or more branches and none tenant-wide: the branch step. */
const needsBranch = (c: MyClinic) => !c.tenantWide && c.branches.length > 1;

/** The branches offered for the current clinic: none for a solo clinic. */
function branchOptions(c: MyClinic): { id: string; name: string | null }[] {
  if (c.solo) return [];
  const branches = c.branches.map((b) => ({ id: b.id, name: b.name }));
  return c.tenantWide ? [{ id: ALL, name: null }, ...branches] : branches;
}

export function ClinicSwitcher({ session }: { session: SessionView }) {
  const text = useText();
  const phone = useIsPhone();
  const toast = useToast();
  const clinics = useMyClinics(session);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const list = clinics.data?.clinics ?? [];
  const invitations = clinics.data?.invitations ?? [];
  const here = list.find((c) => c.tenantId === session.tenantId);

  /**
   * The branch a session in `c` works in, in words: none for a solo clinic (PLT-03), whose
   * sessions still carry its one branch's id (review finding 2); «كل الفروع» for a tenant-wide
   * role with none chosen; the one branch a person holds when the server chose it for them.
   */
  const branchName = (c: MyClinic, id: string | null): string => {
    if (c.solo) return '';
    if (id !== null) return c.branches.find((b) => b.id === id)?.name ?? '';
    if (c.tenantWide) return text('switcherAllBranches');
    return c.branches.length === 1 ? (c.branches[0]?.name ?? '') : '';
  };
  const flow = useClinicSwitch({
    reload: () => void clinics.refetch(),
    askBranch: setStep,
    backToClinics: () => {
      setStep(null);
    },
    onSwitched: (tenantId, branchId) => {
      setOpen(false);
      const to = list.find((c) => c.tenantId === tenantId);
      if (!to) return;
      const branch = branchName(to, branchId);
      toast.show({
        type: 'success',
        title: text('switcherNowIn', { clinic: to.name }),
        ...(branch === '' ? {} : { description: branch }),
      });
    },
  });

  if (!here) return null;
  const options = branchOptions(here);
  const current = branchName(here, session.branchId);
  if (list.length < 2 && options.length < 2 && invitations.length === 0) {
    return <span className="min-w-0 truncate text-data font-medium">{here.name}</span>;
  }

  const roles = (c: MyClinic) => listOf(c.roles.map((r) => text(ROLE_TEXT[r])));
  const describe = (c: MyClinic) => {
    if (!c.selectable) return text('switcherSuspendedLine');
    const scope = c.solo
      ? []
      : c.tenantWide
        ? [text('switcherAllBranches')]
        : c.branches.length > 1
          ? [text('switcherBranchCount', { count: c.branches.length })]
          : c.branches.map((b) => b.name);
    const seen = c.lastActiveAt === null ? [] : [lastActive(Date.parse(c.lastActiveAt), now)];
    return [roles(c), ...scope, ...seen.map((p) => text(p.key, p.values))].join(' · ');
  };
  const choose = (tenantId: string, branchId: string | null, value: string) => {
    setChoosing(value);
    flow.choose(tenantId, branchId);
  };
  const pickClinic = (tenantId: string) => {
    if (flow.busy || tenantId === here.tenantId) return;
    const c = list.find((x) => x.tenantId === tenantId);
    if (!c?.selectable || flow.suspended.has(tenantId)) return;
    flow.clear();
    if (needsBranch(c)) {
      setStep(tenantId);
      return;
    }
    choose(tenantId, null, tenantId);
  };
  const pickBranch = (value: string) => {
    if (flow.busy || value === (session.branchId ?? ALL)) return;
    choose(here.tenantId, value === ALL ? null : value, value);
  };
  const stepClinic = step === null ? undefined : list.find((c) => c.tenantId === step);
  const busy = (value: string) => flow.busy && choosing === value;
  const problem = flow.problem === undefined ? undefined : PROBLEM[flow.problem];
  const label = current === '' ? here.name : `${here.name} · ${current}`;
  const place = current === '' ? here.name : `${here.name}، ${current}`;

  return (
    <>
      <Menu
        presentation={phone ? 'sheet' : 'popover'}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setStep(null);
            flow.clear();
          }
        }}
        onAction={(value) => {
          if (value === 'back') {
            setStep(null);
            flow.clear();
          }
        }}
      >
        <MenuTrigger
          variant="ghost"
          size={phone ? 'sm' : 'md'}
          aria-label={text('switcherLabel', { place })}
          data-testid="clinic-switcher"
        >
          {phone ? here.name : label}
        </MenuTrigger>
        <MenuContent title={text('switcherTitle')} closeLabel={text('switcherClose')}>
          {problem && (
            <div aria-hidden="true" className="p-1">
              <Callout
                tone={problem.tone}
                {...(flow.problem === 'network' ? { icon: 'wifi-slash' as const } : {})}
                title={text(problem.title)}
              >
                {text(problem.body)}
              </Callout>
            </div>
          )}
          {stepClinic ? (
            <>
              <MenuItem value="back" icon="arrow-back" closeOnSelect={false}>
                {text('switcherBack')}
              </MenuItem>
              <p className="m-0 px-3 pb-1 text-data leading-body text-text-muted">
                {text('switcherStepText')}
              </p>
              <MenuRadioGroup
                label={text('switcherBranchesYours', { clinic: stepClinic.name })}
                value={null}
                onValueChange={(value) => {
                  if (!flow.busy) choose(stepClinic.tenantId, value, value);
                }}
              >
                {stepClinic.branches
                  .filter((b) => !flow.gone.has(b.id))
                  .map((b) => (
                    <MenuRadioItem
                      key={b.id}
                      value={b.id}
                      icon="buildings"
                      busy={busy(b.id)}
                      busyLabel={text('switcherBusy')}
                      checkedLabel={text('switcherCurrent')}
                    >
                      {b.name}
                    </MenuRadioItem>
                  ))}
              </MenuRadioGroup>
            </>
          ) : (
            <>
              <MenuRadioGroup
                label={text('switcherClinics')}
                value={here.tenantId}
                onValueChange={pickClinic}
              >
                {list.map((c) => {
                  const off = !c.selectable || flow.suspended.has(c.tenantId);
                  return (
                    <MenuRadioItem
                      key={c.tenantId}
                      value={c.tenantId}
                      avatar={c.name}
                      description={off ? text('switcherSuspendedLine') : describe(c)}
                      {...(off ? { badge: text('chooserSuspended'), disabled: true } : {})}
                      busy={busy(c.tenantId)}
                      busyLabel={text('switcherBusy')}
                      checkedLabel={text('switcherCurrent')}
                    >
                      {c.name}
                    </MenuRadioItem>
                  );
                })}
              </MenuRadioGroup>
              {options.length > 1 && (
                <>
                  <MenuSeparator />
                  <MenuRadioGroup
                    label={text('switcherBranchesIn', { clinic: here.name })}
                    value={session.branchId ?? ALL}
                    onValueChange={pickBranch}
                  >
                    {options
                      .filter((b) => !flow.gone.has(b.id))
                      .map((b) => (
                        <MenuRadioItem
                          key={b.id}
                          value={b.id}
                          icon="buildings"
                          busy={busy(b.id)}
                          busyLabel={text('switcherBusy')}
                          checkedLabel={text('switcherCurrent')}
                        >
                          {b.name ?? text('switcherAllBranches')}
                        </MenuRadioItem>
                      ))}
                  </MenuRadioGroup>
                </>
              )}
              {invitations.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuGroup label={text('switcherInvites')}>
                    {invitations.map((i) => (
                      <MenuNote
                        key={i.id}
                        icon="bell"
                        description={[
                          ...i.roles.map((r) =>
                            r.branchName === null
                              ? text(ROLE_TEXT[r.role])
                              : `${text(ROLE_TEXT[r.role])} · ${r.branchName}`,
                          ),
                          text('switcherInviteHow'),
                        ].join(' · ')}
                      >
                        {i.clinicName}
                      </MenuNote>
                    ))}
                  </MenuGroup>
                </>
              )}
            </>
          )}
        </MenuContent>
      </Menu>
      <span role="alert" className="sr-only">
        {problem ? `${text(problem.title)}. ${text(problem.body)}` : ''}
      </span>
    </>
  );
}
