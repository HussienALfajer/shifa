// A clinic on admin web (slice A-01-10 checkpoint 3; prototype `Main`, approved 2026-11-24; A-01a
// criteria 3, 13). GET /platform/clinics/:id: the clinic's own fields and its owner card, never
// clinic data. Status and subscription end are edited here (PATCH, «حفظ» waits for a change, a
// warning when choosing suspended, no connection names the status still in force). An unknown
// clinic is the 404 page with the way back.
import type { CommonKey } from '@shifa/i18n';
import {
  Badge,
  Button,
  Callout,
  Card,
  DatePicker,
  EmptyState,
  Radio,
  RadioGroup,
  SkeletonGroup,
  SkeletonText,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { LoadFailed } from '../account/load-failed.tsx';
import { dayDate } from '../auth/dates.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { AdminFrame } from './admin-frame.tsx';
import { ButtonLink } from './button-link.tsx';
import {
  type ClinicDetail,
  type ClinicStatus,
  clinicKey,
  STATUS_TONE,
  STATUS_WORD,
  STATUSES,
  TYPE_WORD,
  useClinic,
} from './data.ts';
import { LimitsTab } from './limits-tab.tsx';
import { OwnerCard } from './owner-card.tsx';
import { SettingsTab } from './settings-tab.tsx';
import { SupportTab } from './support-tab.tsx';
import { UsageTab } from './usage-tab.tsx';

interface Note {
  tone: 'success' | 'danger';
  icon?: 'warning' | 'wifi-slash';
  title: CommonKey;
  text?: string;
}

function SubscriptionCard({ clinic }: { clinic: ClinicDetail }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ClinicStatus | null>(null);
  const [end, setEnd] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const nextStatus = status ?? clinic.status;
  const nextEnd = end === undefined ? clinic.subscriptionEnd : end;
  const changed = nextStatus !== clinic.status || nextEnd !== clinic.subscriptionEnd;

  async function save() {
    if (!changed || busy) return;
    setBusy(true);
    setNote(null);
    const kept = text(STATUS_WORD[clinic.status]);
    try {
      const { data } = await shell.api.PATCH('/platform/clinics/{id}', {
        params: { path: { id: clinic.id } },
        body: { status: nextStatus, subscriptionEnd: nextEnd },
      });
      if (!data) {
        setNote({
          tone: 'danger',
          icon: 'warning',
          title: 'clinicNotSavedTitle',
          text: text('clinicNotSavedServer', { status: kept }),
        });
        return;
      }
      queryClient.setQueryData(clinicKey(clinic.id), data);
      await queryClient.invalidateQueries({ queryKey: ['platform', 'clinics'] });
      setStatus(null);
      setEnd(undefined);
      setNote({ tone: 'success', title: 'clinicSaved' });
    } catch {
      // The answer was lost: the change may or may not be saved; saving again is harmless.
      setNote({
        tone: 'danger',
        icon: 'wifi-slash',
        title: 'clinicNotSavedTitle',
        text: text('clinicUnknownText'),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-4 p-(--shifa-card-padding)">
      <h2 className="m-0 text-heading-sm leading-heading font-semibold">
        {text('clinicSubTitle')}
      </h2>
      <RadioGroup
        label={text('fieldStatus')}
        orientation="horizontal"
        value={nextStatus}
        onValueChange={(v) => {
          setStatus(v as ClinicStatus);
          setNote(null);
        }}
      >
        {STATUSES.map((s) => (
          <Radio key={s} value={s}>
            {text(STATUS_WORD[s])}
          </Radio>
        ))}
      </RadioGroup>
      {nextStatus === 'suspended' && clinic.status !== 'suspended' && (
        <Callout tone="warning" title={text('clinicSuspendTitle')}>
          {text('clinicSuspendText')}
        </Callout>
      )}
      <DatePicker
        label={text('fieldEnd')}
        hint={text('fieldEndHint')}
        value={nextEnd}
        onValueChange={(v) => {
          setEnd(v);
          setNote(null);
        }}
      />
      {note && (
        <Callout
          tone={note.tone}
          {...(note.icon === undefined ? {} : { icon: note.icon })}
          title={text(note.title)}
        >
          {note.text}
        </Callout>
      )}
      <div>
        <Button variant="primary" disabled={!changed} loading={busy} onClick={() => void save()}>
          {text('save')}
        </Button>
      </div>
    </Card>
  );
}

function NotFound() {
  const text = useText();
  return (
    <AdminFrame title={text('clinicNotFoundTitle')}>
      <EmptyState
        icon="magnifying-glass"
        title={text('clinicNotFoundTitle')}
        description={text('clinicNotFoundText')}
        actions={
          <ButtonLink to="/" icon="arrow-back">
            {text('navClinics')}
          </ButtonLink>
        }
      />
    </AdminFrame>
  );
}

export function ClinicPage() {
  const text = useText();
  const params: Record<string, string | undefined> = useParams({ strict: false });
  const { data: clinic, isError, refetch } = useClinic(params['id'] ?? '');
  const [tab, setTab] = useState('info');
  if (clinic === null) return <NotFound />;
  if (!clinic) {
    return (
      <AdminFrame title={text('clinicLoading')}>
        {isError ? (
          <LoadFailed retry={refetch} />
        ) : (
          <SkeletonGroup label={text('clinicLoading')}>
            <SkeletonText lines={4} />
          </SkeletonGroup>
        )}
      </AdminFrame>
    );
  }
  return (
    <AdminFrame
      title={clinic.name}
      description={text('clinicMeta', {
        type: text(TYPE_WORD[clinic.type]),
        date: dayDate(Date.parse(clinic.createdAt)),
      })}
      actions={<Badge tone={STATUS_TONE[clinic.status]}>{text(STATUS_WORD[clinic.status])}</Badge>}
    >
      {/* A-02-08: the tabs of board `A02Clinic`; «العيادة» keeps the A-01-10 cards. */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabList aria-label={text('clinicTabs')}>
          <Tab value="info">{text('clinicTabInfo')}</Tab>
          <Tab value="limits">{text('clinicTabLimits')}</Tab>
          <Tab value="settings">{text('clinicTabSettings')}</Tab>
          <Tab value="support">{text('clinicTabSupport')}</Tab>
          <Tab value="usage">{text('clinicTabUsage')}</Tab>
        </TabList>
        <TabPanel value="info">
          <div className="grid max-w-(--shifa-width-140) gap-5">
            <SubscriptionCard clinic={clinic} />
            <OwnerCard clinic={clinic} />
          </div>
        </TabPanel>
        <TabPanel value="limits">
          <LimitsTab clinic={clinic} />
        </TabPanel>
        <TabPanel value="settings">
          <SettingsTab clinicId={clinic.id} />
        </TabPanel>
        <TabPanel value="support">
          <SupportTab clinic={clinic} />
        </TabPanel>
        <TabPanel value="usage">
          <UsageTab clinicId={clinic.id} />
        </TabPanel>
      </Tabs>
    </AdminFrame>
  );
}
