// «تغيير النوع» (slice A-02-08; board `A02Clinic`, states `typeChange`, `typeSaved`; A-02 criteria
// 1, 3): the new type (the current one shown, not offered), the preview of each limit now and
// after (GET …/type-preview?type=), a warning badge where the new limit is under use and the
// Callout naming those limits; an override that stays is marked so. PATCH /platform/clinics/:id
// with the type; the clinic moves to that type's plan at once.
import {
  Badge,
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  Radio,
  RadioGroup,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { type EntitlementItem, keyWord, useTypePreview } from './clinic-data.ts';
import { type ClinicDetail, type ClinicType, TYPE_WORD, TYPES } from './data.ts';
import { GridRow, type TabNote } from './tab-parts.tsx';

// The dialog is 560 px (the drawing's 640 has no token): «بعد التغيير» gets the widest share so
// «35 (يبقى التجاوز)» stays on one line.
const COLUMNS = 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 0.8fr)';

export function TypeDialog({
  clinic,
  items,
  onSaved,
  onClose,
}: {
  clinic: ClinicDetail;
  items: readonly EntitlementItem[];
  onSaved: (saved: ClinicDetail, note: TabNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [type, setType] = useState<ClinicType>(TYPES.find((t) => t !== clinic.type) ?? 'solo');
  const { data: preview, isError, isFetching } = useTypePreview(clinic.id, type);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'server' | 'network' | null>(null);
  const inFlight = useRef(false);
  const overrideOf = (key: string) => {
    const o = items.find((i) => i.key === key)?.override;
    return o && !o.expired ? o : null;
  };
  const usedOf = (key: string, used: number) =>
    items.find((i) => i.key === key)?.used === null ? '—' : String(used);
  // Never a preview from before the latest change: wait for the read in flight.
  const ready = preview?.type === type && !isFetching;
  const over = (ready ? preview.limits : []).filter((l) => l.over);

  async function save() {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    const word = text(TYPE_WORD[type]);
    try {
      const { data } = await shell.api.PATCH('/platform/clinics/{id}', {
        params: { path: { id: clinic.id } },
        body: { type },
      });
      if (data) {
        onSaved(data, {
          tone: 'success',
          title: text('typeSavedTitle', { type: word }),
          text: text('typeSavedText', { type: word }),
        });
        return;
      }
      setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={text('typeTitle')}
        closeLabel={text('close')}
        className="w-(--shifa-width-140)"
      >
        <div className="flex flex-col gap-4">
          <RadioGroup
            label={text('typeNew')}
            orientation="horizontal"
            value={type}
            onValueChange={(v) => {
              setType(v as ClinicType);
              setProblem(null);
            }}
          >
            {TYPES.map((t) => (
              <Radio key={t} value={t} disabled={t === clinic.type}>
                {t === clinic.type
                  ? text('typeCurrent', { type: text(TYPE_WORD[t]) })
                  : text(TYPE_WORD[t])}
              </Radio>
            ))}
          </RadioGroup>
          {!ready ? (
            isError ? (
              <Callout tone="danger" icon="wifi-slash" title={text('loadFailedTitle')}>
                {text('loadFailedText')}
              </Callout>
            ) : (
              <SkeletonGroup label={text('typeLoading')}>
                <SkeletonText lines={4} />
              </SkeletonGroup>
            )
          ) : (
            <div>
              <GridRow columns={COLUMNS} head>
                <span>{text('typeColLimit')}</span>
                <span>{text('typeColNow')}</span>
                <span>{text('typeColNext')}</span>
                <span>{text('limitColUsed')}</span>
              </GridRow>
              {preview.limits.map((l) => {
                const kept = overrideOf(l.key);
                const keptNext = kept !== null && kept.value === l.next;
                return (
                  <GridRow key={l.key} columns={COLUMNS} rowKey={l.key}>
                    <span>{keyWord(text, l.key)}</span>
                    <span className="tabular-nums">
                      {kept === null
                        ? String(l.current)
                        : text('typeOverride', { value: String(l.current) })}
                    </span>
                    <span className="tabular-nums">
                      {l.over ? (
                        <Badge tone="warning">{String(l.next)}</Badge>
                      ) : keptNext ? (
                        text('typeOverrideKept', { value: String(l.next) })
                      ) : (
                        String(l.next)
                      )}
                    </span>
                    <span className="tabular-nums">{usedOf(l.key, l.used)}</span>
                  </GridRow>
                );
              })}
            </div>
          )}
          {over.length > 0 && (
            <Callout
              tone="warning"
              title={text('typeOverTitle', {
                names: over.map((l) => keyWord(text, l.key)).join('، '),
              })}
            >
              {text('typeOverText')}
            </Callout>
          )}
          {problem !== null && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {problem === 'network'
                ? text('typeUnknownText')
                : text('typeNotSavedText', { type: text(TYPE_WORD[clinic.type]) })}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button variant="primary" loading={busy} disabled={!ready} onClick={() => void save()}>
              {text('typeChange')}
            </Button>
          </DialogActions>
        </div>
      </DialogContent>
    </Dialog>
  );
}
