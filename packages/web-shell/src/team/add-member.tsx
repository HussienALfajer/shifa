// «إضافة موظف» (slice A-01-08 checkpoint 3; prototype `Team08`; the `POST /team/members` row of
// the slice's table, A-01b criterion 2, OD-102): name, phone and roles with scope, checked before
// sending; the sensitive toggles start from the chosen roles' default and only a switch that
// differs is sent. Added: the drawer becomes the member's with the link shown once. 400
// `body.phone` and 409 `phone_in_team` under the phone; 409 `branch_archived` as a Callout (the
// branches read again); no connection keeps the input.
import type { CommonKey } from '@shifa/i18n';
import { Button, Callout, DrawerActions, Input } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { phoneRefused } from '../admin/phone.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import {
  type MemberDetail,
  type MemberLink,
  memberKey,
  NAME_MAX,
  PHONE_MAX,
  teamKey,
} from './data.ts';
import { Panel, type TeamContext } from './panel.tsx';
import { changedFromDefault, PermissionsField, type SwitchDraft } from './permissions-field.tsx';
import { draftOf, RolesField, rolesProblem, toRoles } from './roles-field.tsx';

type PhoneProblem = 'missing' | 'invalid' | 'in-team' | null;
type Failure = { title: CommonKey; text: CommonKey; tone: 'warning' | 'danger' } | null;

export function AddMember({
  team,
  onAdded,
}: {
  team: TeamContext;
  onAdded: (member: MemberDetail, link: MemberLink) => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState(() => draftOf([]));
  const [switches, setSwitches] = useState<SwitchDraft>({});
  const [nameMissing, setNameMissing] = useState(false);
  const [phoneProblem, setPhoneProblem] = useState<PhoneProblem>(null);
  const [rolesMissing, setRolesMissing] = useState<CommonKey | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const catalogue = team.catalogue ?? [];

  async function send() {
    if (inFlight.current) return;
    const missingName = name.trim() === '';
    const missingPhone = phone.trim() === '';
    const roleProblem = rolesProblem(roles, team.scoped);
    setNameMissing(missingName);
    setPhoneProblem(missingPhone ? 'missing' : null);
    setRolesMissing(roleProblem);
    setFailure(null);
    if (missingName || missingPhone || roleProblem !== null) return;
    inFlight.current = true;
    setBusy(true);
    const permissions = changedFromDefault(catalogue, switches, roles);
    try {
      const { data, error } = await shell.api.POST('/team/members', {
        body: {
          name: name.trim(),
          phone: phone.trim(),
          roles: toRoles(roles),
          ...(permissions.length > 0 ? { permissions } : {}),
        },
      });
      if (data) {
        queryClient.setQueryData(memberKey(team.tenantId, data.member.id), data.member);
        void queryClient.invalidateQueries({ queryKey: teamKey(team.tenantId), exact: true });
        onAdded(data.member, data.link);
        return;
      }
      const { code } = errorFacts(error);
      if (phoneRefused(error, 'body.phone')) setPhoneProblem('invalid');
      else if (code === 'phone_in_team') setPhoneProblem('in-team');
      else if (code === 'branch_archived') {
        team.rereadBranches();
        setFailure({
          tone: 'warning',
          title: 'memberBranchArchivedTitle',
          text: 'memberBranchArchivedText',
        });
      } else setFailure({ tone: 'danger', title: 'actionFailedTitle', text: 'serverErrorText' });
    } catch {
      // The member may have been added: the list is read again, the input kept.
      void queryClient.invalidateQueries({ queryKey: teamKey(team.tenantId), exact: true });
      setFailure({ tone: 'danger', title: 'memberNetworkTitle', text: 'addNetworkText' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const phoneError: Record<Exclude<PhoneProblem, null>, CommonKey> = {
    missing: 'memberPhoneMissing',
    invalid: 'phoneInvalid',
    'in-team': 'memberPhoneInTeam',
  };
  return (
    <Panel title={text('addTitle')} description={text('addText')}>
      <form
        noValidate
        className="contents"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Input
          label={text('memberName')}
          maxLength={NAME_MAX}
          value={name}
          onValueChange={(v) => {
            setName(v);
            setNameMissing(false);
          }}
          error={nameMissing ? text('memberNameMissing') : undefined}
        />
        <Input
          label={text('memberPhone')}
          maxLength={PHONE_MAX}
          type="tel"
          dir="ltr"
          hint={text('memberPhoneHint')}
          value={phone}
          onValueChange={(v) => {
            setPhone(v);
            setPhoneProblem(null);
          }}
          error={phoneProblem === null ? undefined : text(phoneError[phoneProblem])}
        />
        <RolesField
          draft={roles}
          onChange={(next) => {
            setRoles(next);
            setRolesMissing(null);
          }}
          branches={team.branches}
          scoped={team.scoped}
          lockedOwner={false}
          problem={rolesMissing}
        />
        <PermissionsField
          keys={catalogue.map((k) => k.key)}
          catalogue={catalogue}
          roles={roles}
          draft={switches}
          onChange={setSwitches}
        />
        {failure && (
          <Callout
            tone={failure.tone}
            {...(failure.title === 'memberNetworkTitle' ? { icon: 'wifi-slash' as const } : {})}
            title={text(failure.title)}
          >
            {text(failure.text)}
          </Callout>
        )}
        <DrawerActions>
          <Button type="submit" variant="primary" startIcon="plus" loading={busy}>
            {text('addSubmit')}
          </Button>
        </DrawerActions>
      </form>
    </Panel>
  );
}
