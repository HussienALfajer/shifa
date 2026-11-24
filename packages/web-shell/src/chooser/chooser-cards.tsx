// The cards of the clinic chooser (slice A-01-07 checkpoint 4; prototype `Main`, improvement e):
// a clinic card (initials, name, role chips, trial, suspended or last-used badge, last activity
// and branches in words, or why a suspended clinic cannot be chosen), a branch card, and an open
// invitation (answered on its own link, OD-91). A selectable card is Card with its one CardLink
// around the content, as the analysis named it for code: the whole card is the hit area and the
// focus ring; the link goes home, where the guard lets in only once the switch succeeded, and a
// press runs the switch instead. A suspended card has no link: not focusable, not pressable.
import type { Schemas } from '@shifa/api-client-ts';
import { Avatar, Badge, Card, CardLink, Icon } from '@shifa/ui';
import type { ReactNode } from 'react';
import { clockTime, dayDate } from '../auth/dates.ts';
import { useText } from '../text.ts';
import { lastActive, listOf, ROLE_TEXT } from './chooser-text.ts';

export type MyClinic = Schemas['MyClinic'];
export type MyInvitation = Schemas['MyInvitation'];
export type MyBranch = Schemas['MyBranch'];

const ROW = 'flex min-w-0 items-center gap-4 p-(--shifa-card-padding)';

function Pick({
  testId,
  disabled,
  busy,
  onPick,
  children,
}: {
  testId: string;
  disabled?: boolean;
  busy?: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <Card className="cursor-not-allowed bg-bg-surface-raised shadow-none">
        <div data-testid={testId} aria-disabled="true" className={ROW}>
          {children}
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <CardLink
        href="/"
        data-testid={testId}
        aria-busy={busy ? 'true' : undefined}
        onClick={(event) => {
          event.preventDefault();
          onPick();
        }}
      >
        <span className={ROW}>{children}</span>
      </CardLink>
    </Card>
  );
}

export function ClinicCard({
  clinic,
  first,
  suspended,
  busy,
  now,
  onPick,
}: {
  clinic: MyClinic;
  /** The last used clinic: first in the server's order, with activity. */
  first: boolean;
  /** Not selectable, or suspended during this visit. */
  suspended: boolean;
  busy: boolean;
  now: number;
  onPick: () => void;
}) {
  const text = useText();
  const lastUsed = first && !suspended && clinic.lastActiveAt !== null;
  const meta: string[] = [];
  if (clinic.lastActiveAt !== null) {
    const phrase = lastActive(Date.parse(clinic.lastActiveAt), now);
    meta.push(text(phrase.key, phrase.values));
  }
  if (!clinic.solo && clinic.branches.length > 0)
    meta.push(listOf(clinic.branches.map((b) => b.name)));
  return (
    <Pick testId="clinic-card" disabled={suspended} busy={busy} onPick={onPick}>
      <Avatar name={clinic.name} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-heading-sm leading-heading font-semibold">{clinic.name}</span>
        <span className="flex flex-wrap gap-1">
          {clinic.roles.map((role) => (
            <Badge key={role} tone="brand" icon={false}>
              {text(ROLE_TEXT[role])}
            </Badge>
          ))}
          {clinic.status === 'trial' && (
            <Badge tone="outline" icon={false}>
              {text('chooserTrial')}
            </Badge>
          )}
          {suspended && <Badge tone="warning">{text('chooserSuspended')}</Badge>}
          {lastUsed && (
            <Badge tone="neutral" icon={false}>
              {text('chooserLastUsed')}
            </Badge>
          )}
        </span>
        <span className="text-data leading-body text-text-muted">
          {suspended ? text('chooserSuspendedText') : meta.join(' · ')}
        </span>
      </span>
      {!suspended && <Icon name="caret-forward" size="md" />}
    </Pick>
  );
}

export function BranchCard({
  branch,
  roles,
  busy,
  onPick,
}: {
  branch: MyBranch;
  /** The person's role there, when it is known for every branch. */
  roles: string | undefined;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <Pick testId="branch-card" busy={busy} onPick={onPick}>
      <Icon name="house" size="md" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-heading-sm leading-heading font-semibold">{branch.name}</span>
        {roles !== undefined && (
          <span className="text-data leading-body text-text-muted">{roles}</span>
        )}
      </span>
      <Icon name="caret-forward" size="md" />
    </Pick>
  );
}

export function InvitationCard({ invitation }: { invitation: MyInvitation }) {
  const text = useText();
  const expires = Date.parse(invitation.expiresAt);
  const roles = invitation.roles.map((r) => {
    const role = text(ROLE_TEXT[r.role]);
    return r.branchName === null ? role : `${role} · ${r.branchName}`;
  });
  return (
    <div
      data-testid="invitation"
      className="flex flex-col gap-1 rounded-(--shifa-card-radius) border border-dashed border-border-strong p-(--shifa-card-padding)"
    >
      <span className="text-body leading-body font-medium">
        {text('chooserInviteFrom', { clinic: invitation.clinicName })}
      </span>
      <span className="text-data leading-body text-text-muted">
        {[
          ...roles,
          text('chooserInviteExpires', { date: dayDate(expires), time: clockTime(expires) }),
        ].join(' · ')}
      </span>
      <span className="text-data leading-body">{text('chooserInviteHow')}</span>
    </div>
  );
}
