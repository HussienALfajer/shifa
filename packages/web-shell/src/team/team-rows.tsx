// The team's rows (slice A-01-08 checkpoint 3; prototype `Team08`): the table's columns on a
// tablet or desktop and a card per member on a phone. The name opens the drawer; «أنت» on the
// owner's own row; the phone left to right; roles as «role · branch» badges; the status in words
// and «انتهى الرابط» on a pending member whose link expired (improvement b); the last activity in
// words («لم يدخل بعد» before the first sign-in).
import { Badge, Button, Card, type DataTableColumn } from '@shifa/ui';
import { lastActive, listOf } from '../chooser/chooser-text.ts';
import { useText } from '../text.ts';
import { type MemberSummary, ROLE_WORD, ROLES, STATUS_TONE, STATUS_WORD } from './data.ts';

type Text = ReturnType<typeof useText>;

/** «طبيب · الفرع الرئيسي», «محاسب · كل الفروع», in the order of ROLES. */
export function roleLabels(m: Pick<MemberSummary, 'roles'>, text: Text, scoped: boolean): string[] {
  return [...m.roles]
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
    .map((r) => {
      const role = text(ROLE_WORD[r.role]);
      if (!scoped || r.role === 'owner') return role;
      return `${role} · ${r.branchName ?? text('teamAllBranches')}`;
    });
}

const expired = (m: MemberSummary) =>
  m.status === 'pending' && m.linkExpiresAt !== null && Date.parse(m.linkExpiresAt) <= Date.now();

function NameCell({ m, onOpen }: { m: MemberSummary; onOpen: (id: string) => void }) {
  const text = useText();
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        data-testid="member-open"
        className="min-w-0 justify-start px-1 font-medium text-brand-primary"
        onClick={() => {
          onOpen(m.id);
        }}
      >
        <span className="truncate">{m.name}</span>
      </Button>
      {m.isSelf && (
        <Badge tone="brand" className="shrink-0">
          {text('teamSelf')}
        </Badge>
      )}
    </span>
  );
}

function StatusCell({ m }: { m: MemberSummary }) {
  const text = useText();
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone={STATUS_TONE[m.status]}>{text(STATUS_WORD[m.status])}</Badge>
      {expired(m) && <Badge tone="warning">{text('teamLinkExpired')}</Badge>}
    </span>
  );
}

function RolesCell({ m, scoped }: { m: MemberSummary; scoped: boolean }) {
  const text = useText();
  return (
    <span className="flex flex-wrap gap-1">
      {roleLabels(m, text, scoped).map((label) => (
        <Badge key={label} tone="outline">
          {label}
        </Badge>
      ))}
    </span>
  );
}

function activeWords(m: MemberSummary, text: Text): string {
  if (m.lastActiveAt === null) return text('teamNeverIn');
  const phrase = lastActive(Date.parse(m.lastActiveAt), Date.now());
  return text(phrase.key, phrase.values);
}

const Phone = ({ m }: { m: MemberSummary }) => (
  <bdi dir="ltr" className="tabular-nums">
    {m.phone}
  </bdi>
);

export function useTeamColumns(
  onOpen: (id: string) => void,
  scoped: boolean,
): DataTableColumn<MemberSummary>[] {
  const text = useText();
  return [
    {
      id: 'name',
      header: text('teamColName'),
      width: 'lg',
      value: (m) => m.name,
      cell: (m) => <NameCell m={m} onOpen={onOpen} />,
    },
    {
      id: 'phone',
      header: text('teamColPhone'),
      value: (m) => m.phone,
      cell: (m) => <Phone m={m} />,
    },
    {
      id: 'roles',
      header: text('teamColRoles'),
      width: 'lg',
      value: (m) => listOf(roleLabels(m, text, scoped)),
      cell: (m) => <RolesCell m={m} scoped={scoped} />,
    },
    {
      id: 'status',
      header: text('teamColStatus'),
      value: (m) => text(STATUS_WORD[m.status]),
      cell: (m) => <StatusCell m={m} />,
    },
    {
      id: 'active',
      header: text('teamColActive'),
      value: (m) => m.lastActiveAt ?? '',
      cell: (m) => <span className="text-text-muted">{activeWords(m, text)}</span>,
    },
  ];
}

/** A member on a phone: the same facts, one card each. */
export function MemberCard({
  m,
  scoped,
  onOpen,
}: {
  m: MemberSummary;
  scoped: boolean;
  onOpen: (id: string) => void;
}) {
  const text = useText();
  return (
    <div data-testid="member-card" role="listitem">
      <Card className="gap-2 p-4">
        <NameCell m={m} onOpen={onOpen} />
        <span className="text-data">
          <Phone m={m} />
        </span>
        <RolesCell m={m} scoped={scoped} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusCell m={m} />
          <span className="text-caption text-text-muted">{activeWords(m, text)}</span>
        </div>
      </Card>
    </div>
  );
}
