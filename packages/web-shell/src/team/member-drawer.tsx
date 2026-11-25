// The member drawer (slice A-01-08 checkpoint 3; prototype `Team08`): from the logical end on a
// desktop, a bottom sheet below it. One drawer for «إضافة موظف» and for a member; after adding,
// it becomes the member's with the link shown once. Closing while a link is shown and was neither
// copied nor shared asks first (improvement h). The member: status, «أنت», phone, a pending
// member's link expiry or «انتهى الرابط» (improvement b) and «تصحيح الرقم» (OD-103), the form,
// the account actions; a 404 says the person left the team.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
  Callout,
  Drawer,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LinkShown, type MemberLinkShown } from '../admin/link-shown.tsx';
import { clockTime, dayDate } from '../auth/dates.ts';
import { useBelowDesktop } from '../auth/media.ts';
import { useText } from '../text.ts';
import { AddMember } from './add-member.tsx';
import {
  type MemberDetail,
  type MemberLink,
  memberKey,
  STATUS_TONE,
  STATUS_WORD,
  teamKey,
  useMember,
} from './data.ts';
import { GONE, MemberAccount, type Note } from './member-account.tsx';
import { MemberForm } from './member-form.tsx';
import { MemberPhoneDialog } from './member-phone-dialog.tsx';
import { Panel, type TeamContext } from './panel.tsx';
import type { KeyDefault } from './permissions-field.tsx';

export type DrawerTarget = { kind: 'add' } | { kind: 'member'; id: string; link?: MemberLink };

export function TeamDrawer({
  team,
  target,
  onTarget,
  onClose,
}: {
  team: TeamContext;
  target: DrawerTarget;
  onTarget: (next: DrawerTarget) => void;
  onClose: () => void;
}) {
  const text = useText();
  const below = useBelowDesktop();
  const [unsent, setUnsent] = useState(false);
  const [asking, setAsking] = useState(false);
  const close = () => {
    if (unsent) setAsking(true);
    else onClose();
  };
  return (
    <Drawer
      open
      side={below ? 'bottom' : 'end'}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {target.kind === 'add' ? (
        <AddMember
          team={team}
          onAdded={(member, link) => {
            // The link is shown at once and nobody has copied it yet.
            setUnsent(true);
            onTarget({ kind: 'member', id: member.id, link });
          }}
        />
      ) : (
        <MemberPanel
          key={target.id}
          team={team}
          id={target.id}
          first={target.link}
          onUnsent={setUnsent}
        />
      )}
      <AlertDialog open={asking} onOpenChange={setAsking}>
        {asking && (
          <AlertDialogContent
            tone="danger"
            title={text('linkLeaveTitle')}
            description={text('linkLeaveText')}
          >
            <AlertDialogCancel>{text('linkLeaveStay')}</AlertDialogCancel>
            <AlertDialogAction onAction={onClose}>{text('linkLeaveGo')}</AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </Drawer>
  );
}

/** The catalogue, or one made from the member's own defaults while it loads. */
const catalogueFor = (member: MemberDetail, loaded: readonly KeyDefault[] | undefined) =>
  loaded ??
  member.permissions.map((p) => ({
    key: p.key,
    roles: p.roleDefault ? member.roles.map((r) => r.role) : [],
  }));

function MemberPanel({
  team,
  id,
  first,
  onUnsent,
}: {
  team: TeamContext;
  id: string;
  first: MemberLink | undefined;
  onUnsent: (unsent: boolean) => void;
}) {
  const text = useText();
  const queryClient = useQueryClient();
  const { data: member, isError, refetch } = useMember(team.tenantId, id);
  const [note, setNote] = useState<Note | null>(null);
  const [link, setLink] = useState<MemberLink | null>(first ?? null);
  const [fixing, setFixing] = useState(false);

  const reread = () => {
    void queryClient.invalidateQueries({ queryKey: memberKey(team.tenantId, id) });
    void queryClient.invalidateQueries({ queryKey: teamKey(team.tenantId), exact: true });
  };
  const update = (next: MemberDetail) => {
    queryClient.setQueryData(memberKey(team.tenantId, id), next);
    void queryClient.invalidateQueries({ queryKey: teamKey(team.tenantId), exact: true });
  };
  const show = (issued: MemberLink) => {
    setLink(issued);
    onUnsent(true);
  };

  if (member === undefined) {
    return (
      <Panel title={text('memberLoading')}>
        {isError ? (
          <Callout tone="danger" icon="wifi-slash" title={text('loadFailedTitle')}>
            {text('loadFailedText')}
          </Callout>
        ) : (
          <SkeletonGroup label={text('memberLoading')}>
            <SkeletonText lines={6} />
          </SkeletonGroup>
        )}
        {isError && (
          <Button variant="secondary" onClick={() => void refetch()}>
            {text('retry')}
          </Button>
        )}
      </Panel>
    );
  }
  if (member === null) {
    return (
      <Panel title={text(GONE.title)}>
        <Callout tone="warning" title={text(GONE.title)}>
          {text(GONE.text)}
        </Callout>
      </Panel>
    );
  }

  const expires = member.linkExpiresAt === null ? null : Date.parse(member.linkExpiresAt);
  const shown: MemberLinkShown | null = link && { ...link, member: member.name };
  const formKey = JSON.stringify([member.name, member.roles, member.permissions, member.status]);
  return (
    <Panel title={member.name} description={text(STATUS_WORD[member.status])}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[member.status]}>{text(STATUS_WORD[member.status])}</Badge>
        {member.isSelf && <Badge tone="brand">{text('teamSelf')}</Badge>}
        <bdi dir="ltr" className="text-data tabular-nums">
          {member.phone}
        </bdi>
        {member.status === 'pending' && (
          <Button
            size="sm"
            variant="ghost"
            startIcon="phone"
            onClick={() => {
              setFixing(true);
            }}
          >
            {text('memberFixPhone')}
          </Button>
        )}
      </div>
      {member.status === 'pending' && expires !== null && link === null && (
        <Callout tone={expires > Date.now() ? 'info' : 'warning'} icon="clock">
          {expires > Date.now()
            ? text('memberLinkOpen', { date: `${dayDate(expires)} ${clockTime(expires)}` })
            : text('teamLinkExpired')}
        </Callout>
      )}
      {shown && (
        <section className="flex flex-col gap-3 rounded-card border border-border-default p-4">
          <h3 className="m-0 text-body leading-heading font-semibold">
            {text('memberLinkTitle', { name: member.name })}
          </h3>
          {/* A replaced link starts unsent. */}
          <LinkShown
            key={shown.url}
            link={shown}
            onSent={() => {
              onUnsent(false);
            }}
          />
        </section>
      )}
      {note && (
        <Callout data-testid="member-note" tone={note.tone} title={text(note.title)}>
          {text(note.text)}
        </Callout>
      )}
      <MemberForm
        key={formKey}
        member={member}
        branches={team.branches}
        scoped={team.scoped}
        catalogue={catalogueFor(member, team.catalogue)}
        onSaved={update}
        onNote={setNote}
        rereadBranches={team.rereadBranches}
      >
        <MemberAccount
          member={member}
          onDetail={update}
          onLink={show}
          onNote={setNote}
          reread={reread}
        />
      </MemberForm>
      {fixing && (
        <MemberPhoneDialog
          memberId={member.id}
          name={member.name}
          onIssued={(issued) => {
            setFixing(false);
            show(issued);
            reread();
          }}
          onRefused={(refused) => {
            setFixing(false);
            setNote(refused);
            reread();
          }}
          onClose={() => {
            setFixing(false);
          }}
        />
      )}
    </Panel>
  );
}
