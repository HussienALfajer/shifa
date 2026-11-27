// «تغيير» of a flag (slice A-02-09 checkpoint 2; drawing `A02Flags`, states `change` … `saved`;
// contract row "Flags · change"): the mode (off for all is the kill switch, with its warning), the
// clinic picker for `selected` (kept from the flag), the reason of 10–500 characters; «متابعة»
// checks them, then a confirmation names the change, then PUT /platform/flags/:key. A 400 on
// body.clinicIds or body.reason goes back to the field; a 404 (no longer in code) closes it, the
// page names it and reads the list again; no connection stays in the confirmation.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  Radio,
  RadioGroup,
  Textarea,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { listOf } from '../../chooser/chooser-text.ts';
import { useShell } from '../../providers.tsx';
import { useText } from '../../text.ts';
import { type AdminNote, ClinicPicker, fieldRefused } from '../a02.tsx';
import { useClinics } from '../data.ts';
import {
  type Flag,
  type FlagMode,
  flagTitle,
  MODE_WORD,
  MODES,
  REASON_MAX,
  REASON_MIN,
} from './data.ts';

type Step = 'edit' | 'confirm';

export function FlagDialog({
  flag,
  onDone,
  onClose,
}: {
  flag: Flag;
  /** Saved, or refused in a way the dialog cannot fix: the page shows the note and reads again. */
  onDone: (note: AdminNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const title = flagTitle(flag, text);
  const [mode, setMode] = useState<FlagMode>(flag.mode);
  const [clinicIds, setClinicIds] = useState<string[]>(flag.clinics.map((c) => c.id));
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<Step>('edit');
  const [pickerError, setPickerError] = useState(false);
  const [reasonError, setReasonError] = useState(false);
  const [failure, setFailure] = useState('');
  // The confirmation closes itself once its action resolves: where to go then.
  const after = useRef<'edit' | 'done' | null>(null);

  const known = flag.clinics;
  const { data: clinics } = useClinics('');
  const names = (() => {
    const byId = new Map([...known, ...(clinics ?? [])].map((c) => [c.id, c.name]));
    return clinicIds.map((id) => byId.get(id)).filter((n): n is string => n !== undefined);
  })();

  function next() {
    const noClinic = mode === 'selected' && clinicIds.length === 0;
    const shortReason = reason.trim().length < REASON_MIN;
    setPickerError(noClinic);
    setReasonError(shortReason);
    if (noClinic || shortReason) return;
    setFailure('');
    setStep('confirm');
  }

  async function save() {
    setFailure(`${text('unreachableTitle')}. ${text('loadFailedText')}`);
    const { data, error, response } = await shell.api.PUT('/platform/flags/{key}', {
      params: { path: { key: flag.key } },
      body: {
        mode,
        reason: reason.trim(),
        ...(mode === 'selected' ? { clinicIds } : {}),
      },
    });
    if (data) {
      after.current = 'done';
      onDone({
        tone: 'success',
        title: text('flagSavedTitle', { name: title }),
        text: text('flagSavedText', { mode: data.mode }),
      });
      return;
    }
    if (fieldRefused(error, 'body.clinicIds') || fieldRefused(error, 'body.reason')) {
      setPickerError(fieldRefused(error, 'body.clinicIds'));
      setReasonError(fieldRefused(error, 'body.reason'));
      after.current = 'edit';
      return;
    }
    if (response.status === 404) {
      after.current = 'done';
      onDone({ tone: 'warning', title: text('flagGoneTitle'), text: text('flagGoneText') });
      return;
    }
    setFailure(text('serverErrorText'));
    throw new Error(`PUT /platform/flags answered ${String(response.status)}`);
  }

  if (step === 'confirm') {
    const change = text('flagConfirmText', {
      name: title,
      from: text(MODE_WORD[flag.mode]),
      to: text(MODE_WORD[mode]),
      reason: reason.trim(),
    });
    return (
      <AlertDialog
        open
        onOpenChange={(open) => {
          if (open) return;
          const go = after.current;
          after.current = null;
          if (go === 'done') return;
          // «رجوع» goes back to the form with what was typed; a refusal on a field too.
          setStep('edit');
        }}
      >
        <AlertDialogContent
          tone="info"
          title={text('flagConfirmTitle')}
          description={
            mode === 'selected' && names.length > 0
              ? `${change} ${text('flagConfirmClinics', { names: listOf(names) })}`
              : change
          }
        >
          <AlertDialogCancel>{text('back')}</AlertDialogCancel>
          <AlertDialogAction variant="primary" errorText={failure} onAction={save}>
            {text('flagConfirm')}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={text('flagDialogTitle', { name: title })}
        description={
          <span dir="ltr" className="font-mono">
            {flag.key}
          </span>
        }
        closeLabel={text('close')}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            next();
          }}
        >
          <RadioGroup
            label={text('flagMode')}
            value={mode}
            onValueChange={(v) => {
              setMode(v as FlagMode);
              setPickerError(false);
            }}
          >
            {MODES.map((m) => (
              <Radio
                key={m}
                value={m}
                description={m === 'off' ? text('flagModeOffHint') : undefined}
              >
                {text(MODE_WORD[m])}
              </Radio>
            ))}
          </RadioGroup>
          {mode === 'off' && (
            <Callout tone="warning" title={text('flagOffWarnTitle')}>
              {text('flagOffWarnText')}
            </Callout>
          )}
          {mode === 'selected' && (
            <ClinicPicker
              value={clinicIds}
              onValueChange={(ids) => {
                setClinicIds(ids);
                if (ids.length > 0) setPickerError(false);
              }}
              known={known}
              hint={
                clinicIds.length === 0
                  ? text('pickerHintNone')
                  : text('pickerHintSome', { count: clinicIds.length })
              }
              error={pickerError}
            />
          )}
          <Textarea
            label={text('flagReason')}
            required
            maxLength={REASON_MAX}
            value={reason}
            onValueChange={(v) => {
              setReason(v);
              if (reasonError && v.trim().length >= REASON_MIN) setReasonError(false);
            }}
            hint={text('flagReasonHint')}
            error={reasonError ? text('flagReasonMissing') : undefined}
          />
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary">
              {text('flagContinue')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
