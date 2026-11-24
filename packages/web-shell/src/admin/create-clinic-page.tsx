// «إنشاء عيادة» on admin web (slice A-01-10 checkpoint 3; prototype `Main`, approved 2026-11-24;
// A-01a criterion 3). POST /platform/clinics with the clinic (name, type, status, subscription
// end) and its owner (name, phone). An empty name, owner or phone is refused before sending; 400
// on `body.ownerPhone` under the phone; 409 `owner_setup_pending` with what to do; no connection
// keeps the input. Success shows the owner's link once (LinkShown) and «فتح صفحة العيادة».
import { Button, Callout, Card, DatePicker, Input, Radio, RadioGroup } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { AdminFrame } from './admin-frame.tsx';
import {
  type ClinicDetail,
  type ClinicStatus,
  type ClinicType,
  clinicKey,
  type SetupLink,
  STATUS_WORD,
  STATUSES,
  TYPE_WORD,
  TYPES,
} from './data.ts';
import { LinkShown } from './link-shown.tsx';
import { phoneRefused } from './phone.ts';

type Problem = 'pending' | 'network' | 'server' | null;

interface Form {
  name: string;
  type: ClinicType;
  status: ClinicStatus;
  end: string | null;
  ownerName: string;
  ownerPhone: string;
}

const EMPTY: Form = {
  name: '',
  type: 'solo',
  status: 'trial',
  end: null,
  ownerName: '',
  ownerPhone: '',
};

export function CreateClinicPage() {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [tried, setTried] = useState(false);
  const [phoneWrong, setPhoneWrong] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ clinic: ClinicDetail; link: SetupLink } | null>(null);
  const inFlight = useRef(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'ownerPhone') setPhoneWrong(false);
  };
  const missing = {
    name: form.name.trim() === '',
    ownerName: form.ownerName.trim() === '',
    ownerPhone: form.ownerPhone.trim() === '',
  };

  async function submit() {
    setTried(true);
    if (inFlight.current || missing.name || missing.ownerName || missing.ownerPhone) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, error } = await shell.api.POST('/platform/clinics', {
        body: {
          name: form.name.trim(),
          type: form.type,
          status: form.status,
          subscriptionEnd: form.end,
          ownerName: form.ownerName.trim(),
          ownerPhone: form.ownerPhone.trim(),
        },
      });
      if (data) {
        queryClient.setQueryData(clinicKey(data.clinic.id), data.clinic);
        await queryClient.invalidateQueries({ queryKey: ['platform', 'clinics'] });
        setDone({ clinic: data.clinic, link: data.ownerLink });
        return;
      }
      const { code } = errorFacts(error);
      if (phoneRefused(error, 'body.ownerPhone')) setPhoneWrong(true);
      else if (code === 'owner_setup_pending') setProblem('pending');
      else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AdminFrame
        title={text('createdTitle')}
        description={text('createdText', { owner: done.clinic.owner?.name ?? '' })}
      >
        <Card className="gap-4 p-(--shifa-card-padding)">
          <h2 className="m-0 text-heading-sm leading-heading font-semibold">{done.clinic.name}</h2>
          <LinkShown link={done.link} />
          <div>
            <Button
              variant="primary"
              onClick={() => void navigate({ to: '/clinics/$id', params: { id: done.clinic.id } })}
            >
              {text('linkOpenClinic')}
            </Button>
          </div>
        </Card>
      </AdminFrame>
    );
  }

  return (
    <AdminFrame title={text('createTitle')} description={text('createText')}>
      <form
        noValidate
        className="flex max-w-(--shifa-width-140) flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Card className="gap-4 p-(--shifa-card-padding)">
          <h2 className="m-0 text-heading-sm leading-heading font-semibold">
            {text('createClinicSection')}
          </h2>
          <Input
            label={text('fieldClinicName')}
            value={form.name}
            onValueChange={(v) => {
              set('name', v);
            }}
            error={tried && missing.name ? text('createNameMissing') : undefined}
          />
          <RadioGroup
            label={text('fieldClinicType')}
            orientation="horizontal"
            value={form.type}
            onValueChange={(v) => {
              set('type', v as ClinicType);
            }}
          >
            {TYPES.map((t) => (
              <Radio key={t} value={t}>
                {text(TYPE_WORD[t])}
              </Radio>
            ))}
          </RadioGroup>
          <RadioGroup
            label={text('fieldStatus')}
            orientation="horizontal"
            value={form.status}
            onValueChange={(v) => {
              set('status', v as ClinicStatus);
            }}
          >
            {STATUSES.map((s) => (
              <Radio key={s} value={s}>
                {text(STATUS_WORD[s])}
              </Radio>
            ))}
          </RadioGroup>
          {form.status === 'suspended' && (
            <Callout tone="warning" title={text('clinicSuspendTitle')}>
              {text('clinicSuspendText')}
            </Callout>
          )}
          <DatePicker
            label={text('fieldEnd')}
            hint={text('fieldEndHint')}
            value={form.end}
            onValueChange={(v) => {
              set('end', v);
            }}
          />
        </Card>
        <Card className="gap-4 p-(--shifa-card-padding)">
          <h2 className="m-0 text-heading-sm leading-heading font-semibold">
            {text('createOwnerSection')}
          </h2>
          <Input
            label={text('fieldOwnerName')}
            value={form.ownerName}
            onValueChange={(v) => {
              set('ownerName', v);
            }}
            error={tried && missing.ownerName ? text('createOwnerMissing') : undefined}
          />
          <Input
            label={text('fieldOwnerPhone')}
            type="tel"
            dir="ltr"
            hint={text('fieldOwnerPhoneHint')}
            value={form.ownerPhone}
            onValueChange={(v) => {
              set('ownerPhone', v);
            }}
            error={
              tried && missing.ownerPhone
                ? text('createPhoneMissing')
                : phoneWrong
                  ? text('phoneInvalid')
                  : undefined
            }
          />
        </Card>
        {problem === 'pending' && (
          <Callout tone="warning" title={text('createPendingTitle')}>
            {text('createPendingText')}
          </Callout>
        )}
        {(problem === 'network' || problem === 'server') && (
          <Callout
            tone="danger"
            icon={problem === 'network' ? 'wifi-slash' : 'warning'}
            title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
          >
            {text(problem === 'network' ? 'adminNetworkText' : 'serverErrorText')}
          </Callout>
        )}
        <div>
          <Button type="submit" variant="primary" startIcon="plus" loading={busy}>
            {text('createSubmit')}
          </Button>
        </div>
      </form>
    </AdminFrame>
  );
}
