// The override dialog of «الاشتراك والحدود» (slice A-02-08; board `A02Clinic`, states `override`,
// `overrideError`, `overrideSaved`; A-02 criterion 3): the value by the key's kind (a whole number
// for a limit, on or off for a feature), a mandatory reason of 10–500 characters and an optional
// expiry after today (Damascus). PUT /platform/clinics/:id/overrides/:key; each refused field is
// named on its field; a key gone meanwhile closes the dialog and reloads the list.
import {
  Button,
  Callout,
  DatePicker,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  NumberInput,
  Switch,
  Textarea,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { damascusToday, type EntitlementItem, keyWord, nextDay } from './clinic-data.ts';
import { calendarDate } from './data.ts';
import type { TabNote } from './tab-parts.tsx';

const REASON_MIN = 10;
const REASON_MAX = 500;
const VALUE_MAX = 100_000;

type Problem = 'value' | 'reason' | 'expiry' | 'server' | 'network';

interface Issue {
  path?: unknown;
}

function fieldOf(body: unknown): Problem {
  const details = (body as { error?: { details?: Issue[] } } | null)?.error?.details ?? [];
  const paths = details.map((d) => String(d.path));
  if (paths.includes('body.reason')) return 'reason';
  if (paths.includes('body.expiresAt')) return 'expiry';
  if (paths.includes('body.value')) return 'value';
  return 'server';
}

export function OverrideDialog({
  clinicId,
  item,
  onSaved,
  onGone,
  onClose,
}: {
  clinicId: string;
  item: EntitlementItem;
  onSaved: (saved: EntitlementItem, note: TabNote) => void;
  onGone: () => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const name = keyWord(text, item.key);
  const kept = item.override !== null && !item.override.expired ? item.override : null;
  const [value, setValue] = useState<number | boolean | null>(kept?.value ?? item.planValue);
  const [reason, setReason] = useState(kept?.reason ?? '');
  const [expiry, setExpiry] = useState<string | null>(kept?.expiresAt ?? null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const tomorrow = nextDay(damascusToday());

  async function save() {
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if (item.kind === 'limit' && (typeof value !== 'number' || !Number.isInteger(value))) {
      setProblem('value');
      return;
    }
    if (trimmed.length < REASON_MIN) {
      setProblem('reason');
      return;
    }
    if (expiry !== null && expiry < tomorrow) {
      setProblem('expiry');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, error, response } = await shell.api.PUT(
        '/platform/clinics/{id}/overrides/{key}',
        {
          params: { path: { id: clinicId, key: item.key } },
          body: { value: value ?? 0, reason: trimmed, expiresAt: expiry },
        },
      );
      if (data) {
        const shown = String(data.override?.value ?? data.effective);
        onSaved(data, {
          tone: 'success',
          title: text('overrideSavedTitle'),
          text:
            expiry === null
              ? text('overrideSavedNoEnd', { name, value: shown })
              : text('overrideSavedUntil', { name, value: shown, date: calendarDate(expiry) }),
        });
        return;
      }
      if (response.status === 404) {
        onGone();
        return;
      }
      setProblem(response.status === 400 ? fieldOf(error) : 'server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const fieldError = (p: Problem, key: Parameters<typeof text>[0]) =>
    problem === p ? text(key) : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={text('overrideTitle', { name })} closeLabel={text('close')}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Callout tone="info">
            {item.used === null
              ? text('overridePlan', { plan: String(item.planValue) })
              : text('overridePlanUsed', { plan: String(item.planValue), used: String(item.used) })}
          </Callout>
          {item.kind === 'limit' ? (
            <NumberInput
              label={text('overrideValue')}
              min={0}
              max={VALUE_MAX}
              value={typeof value === 'number' ? value : null}
              onValueChange={(v) => {
                setValue(v);
                if (problem === 'value') setProblem(null);
              }}
              error={fieldError('value', 'overrideValueInvalid')}
            />
          ) : (
            <Switch checked={value === true} onCheckedChange={setValue}>
              {text('overrideFeature')}
            </Switch>
          )}
          <Textarea
            label={text('overrideReason')}
            required
            maxLength={REASON_MAX}
            value={reason}
            onValueChange={(v) => {
              setReason(v);
              if (problem === 'reason') setProblem(null);
            }}
            hint={text('overrideReasonHint')}
            error={fieldError('reason', 'overrideReasonMissing')}
          />
          <DatePicker
            label={text('overrideExpiry')}
            hint={text('overrideExpiryHint')}
            min={tomorrow}
            value={expiry}
            onValueChange={(v) => {
              setExpiry(v);
              if (problem === 'expiry') setProblem(null);
            }}
            error={fieldError('expiry', 'overrideExpiryPast')}
          />
          {(problem === 'server' || problem === 'network') && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'clinicUnknownText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary" loading={busy}>
              {text('overrideSave')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
