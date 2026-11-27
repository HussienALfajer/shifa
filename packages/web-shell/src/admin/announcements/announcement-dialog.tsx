// «إعلان جديد» and «تعديل الإعلان» (slice A-02-09 checkpoint 2; drawing `A02Announcements`,
// states `form`, `formSome`, `linkError`, `created`, `edit`; A-02 criteria 16, 23; contract rows
// "Announcements · create" and "· edit"): the body (plain text up to 280, a link refused before
// sending with the rule the server applies), the level, a preview of the banner as members will
// see it (PageBanner, updated as the body and level change), start and optional end on the
// device's clock, all clinics or selected ones. A new one starting now sends this moment; an edit
// sends only what changed. 400 on a field goes to it; 409 `announcement_ended` or 404 closes it,
// named on the page, the list read again; no connection keeps the input.

import type { Schemas } from '@shifa/api-client-ts';
import { hasAnnouncementLink } from '@shifa/contracts';
import {
  Button,
  Callout,
  DatePicker,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  PageBanner,
  Radio,
  RadioGroup,
  Textarea,
  TimeInput,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { errorFacts } from '../../client.ts';
import { useShell } from '../../providers.tsx';
import { useText } from '../../text.ts';
import { type AdminNote, ClinicPicker, fieldRefused, useMoment } from '../a02.tsx';

type CreateBody = Schemas['CreateAnnouncementRequest'];

import {
  type Announcement,
  type AnnouncementLevel,
  BODY_MAX,
  instantOf,
  LEVEL_TITLE,
  LEVEL_WORD,
  localParts,
} from './data.ts';

type Target = 'all' | 'selected';
type Problem =
  | 'body'
  | 'link'
  | 'start'
  | 'startTime'
  | 'end'
  | 'endDate'
  | 'endTime'
  | 'clinics'
  | 'network'
  | 'server'
  | null;

export function AnnouncementDialog({
  item,
  onDone,
  onClose,
}: {
  /** The announcement edited; none to create one. */
  item?: Announcement;
  onDone: (note: AdminNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const moment = useMoment();
  const start = localParts(item?.startsAt ?? new Date().toISOString());
  const end = item?.endsAt ? localParts(item.endsAt) : null;
  const [body, setBody] = useState(item?.body ?? '');
  const [level, setLevel] = useState<AnnouncementLevel>(item?.level ?? 'info');
  const [startDate, setStartDate] = useState<string | null>(start.date);
  const [startTime, setStartTime] = useState<string | null>(start.time);
  const [startTouched, setStartTouched] = useState(false);
  const [endDate, setEndDate] = useState<string | null>(end?.date ?? null);
  const [endTime, setEndTime] = useState<string | null>(end?.time ?? null);
  const [target, setTarget] = useState<Target>(item?.target ?? 'all');
  const [clinicIds, setClinicIds] = useState<string[]>(item?.clinics.map((c) => c.id) ?? []);
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const trimmed = body.trim();
  const linked = hasAnnouncementLink(body);
  const touchStart = () => {
    setStartTouched(true);
    if (problem === 'start' || problem === 'end') setProblem(null);
  };

  /** The fields as they would be sent; an edit keeps only those that changed. */
  function fields() {
    const startsAt =
      item === undefined && !startTouched
        ? new Date().toISOString()
        : (instantOf(startDate, startTime) ?? '');
    // An end day without a time ends with that day.
    // A date and a whole time each (check() refuses a half-typed one, which TimeInput reports
    // as null like an empty one): nothing falls back to midnight.
    const endsAt = instantOf(endDate, endTime);
    const all = {
      body: trimmed,
      level,
      startsAt,
      endsAt,
      target,
      ...(target === 'selected' ? { clinicIds } : {}),
    };
    if (item === undefined) return all;
    const sameClinics =
      item.clinics.length === clinicIds.length &&
      item.clinics.every((c) => clinicIds.includes(c.id));
    return {
      ...(trimmed !== item.body ? { body: trimmed } : {}),
      ...(level !== item.level ? { level } : {}),
      ...(startTouched ? { startsAt } : {}),
      ...(endsAt !== item.endsAt && !(end && endsAt === instantOf(end.date, end.time))
        ? { endsAt }
        : {}),
      ...(target !== item.target ? { target } : {}),
      ...(target === 'selected' && (!sameClinics || target !== item.target) ? { clinicIds } : {}),
    };
  }

  function check(): Problem {
    if (trimmed === '') return 'body';
    if (linked) return 'link';
    if (startTouched && instantOf(startDate, startTime) === null) return 'start';
    if (startTouched && startTime === null) return 'startTime';
    if (endDate !== null && endTime === null) return 'endTime';
    if (endDate === null && endTime !== null) return 'endDate';
    const s = fields();
    const endsAt = 'endsAt' in s ? s.endsAt : null;
    const startsAt = 'startsAt' in s ? s.startsAt : (item?.startsAt ?? '');
    if (
      endsAt &&
      (Date.parse(endsAt) <= Date.parse(startsAt) || Date.parse(endsAt) <= Date.now())
    ) {
      return 'end';
    }
    if (target === 'selected' && clinicIds.length === 0) return 'clinics';
    return null;
  }

  async function send() {
    if (inFlight.current) return;
    const found = check();
    setProblem(found);
    if (found) return;
    const payload = fields();
    if (item !== undefined && Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const answer =
        item === undefined
          ? await shell.api.POST('/platform/announcements', {
              body: payload as CreateBody,
            })
          : await shell.api.PATCH('/platform/announcements/{id}', {
              params: { path: { id: item.id } },
              body: payload,
            });
      const { data, error, response } = answer;
      if (data) {
        onDone(
          item !== undefined
            ? { tone: 'success', title: text('annSavedTitle'), text: text('annSavedText') }
            : data.status === 'scheduled'
              ? {
                  tone: 'success',
                  title: text('annCreatedScheduled'),
                  text: text('annCreatedScheduledText', {
                    when: moment(data.startsAt),
                  }),
                }
              : {
                  tone: 'success',
                  title: text('annCreatedActive'),
                  text: text('annCreatedActiveText'),
                },
        );
        return;
      }
      const { code } = errorFacts(error);
      if (code === 'announcement_link') setProblem('link');
      else if (fieldRefused(error, 'body.body')) setProblem('body');
      else if (fieldRefused(error, 'body.endsAt')) setProblem('end');
      else if (fieldRefused(error, 'body.startsAt')) setProblem('start');
      else if (fieldRefused(error, 'body.clinicIds')) setProblem('clinics');
      else if (code === 'announcement_ended' || response.status === 404) {
        onDone({ tone: 'warning', title: text('annGoneTitle'), text: text('annGoneText') });
      } else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const showPreview = trimmed !== '' && !linked;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={text(item === undefined ? 'annFormNew' : 'annFormEdit')}
        closeLabel={text('close')}
        className="max-w-(--shifa-width-140)"
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Textarea
            label={text('annBody')}
            required
            maxLength={BODY_MAX}
            value={body}
            onValueChange={(v) => {
              setBody(v);
              if (problem === 'body' || problem === 'link') setProblem(null);
            }}
            hint={text('annBodyHint')}
            error={
              problem === 'body'
                ? text('annBodyMissing')
                : problem === 'link'
                  ? text('annBodyLink')
                  : undefined
            }
          />
          <RadioGroup
            label={text('annLevel')}
            orientation="horizontal"
            value={level}
            onValueChange={(v) => {
              setLevel(v as AnnouncementLevel);
            }}
          >
            <Radio value="info">{text('annLevelInfo')}</Radio>
            <Radio value="warning">{text('annLevelWarning')}</Radio>
          </RadioGroup>
          <div
            data-testid="announcement-preview"
            className="flex flex-col gap-2 rounded-control border border-dashed border-border-default p-3"
          >
            <span className="text-caption text-text-muted">{text('annPreview')}</span>
            {showPreview ? (
              // A picture of the banner, close button included: inert, so its «إغلاق» is not
              // a second, dead one beside the dialog's.
              <div inert>
                <PageBanner
                  tone={level}
                  title={text(LEVEL_TITLE[level])}
                  aria-label={text(LEVEL_WORD[level])}
                  onDismiss={() => undefined}
                  dismissLabel={text('close')}
                >
                  {trimmed}
                </PageBanner>
              </div>
            ) : (
              <span className="text-caption text-text-muted">{text('annPreviewWaiting')}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label={text('annStartDate')}
              required
              value={startDate}
              onValueChange={(v) => {
                setStartDate(v);
                touchStart();
              }}
              error={problem === 'start' ? text('annStartMissing') : undefined}
            />
            <TimeInput
              label={text('annStartTime')}
              value={startTime}
              onValueChange={(v) => {
                setStartTime(v);
                touchStart();
                if (problem === 'startTime') setProblem(null);
              }}
              error={problem === 'startTime' ? text('annTimeMissing') : undefined}
            />
            <DatePicker
              label={text('annEndDate')}
              hint={text('annOptional')}
              value={endDate}
              onValueChange={(v) => {
                setEndDate(v);
                if (problem === 'end' || problem === 'endDate' || problem === 'endTime') {
                  setProblem(null);
                }
              }}
              error={
                problem === 'end'
                  ? text('annEndBeforeStart')
                  : problem === 'endDate'
                    ? text('annEndDateMissing')
                    : undefined
              }
            />
            <TimeInput
              label={text('annEndTime')}
              value={endTime}
              onValueChange={(v) => {
                setEndTime(v);
                if (problem === 'end' || problem === 'endTime' || problem === 'endDate') {
                  setProblem(null);
                }
              }}
              error={problem === 'endTime' ? text('annTimeMissing') : undefined}
            />
          </div>
          <RadioGroup
            label={text('annTargets')}
            orientation="horizontal"
            value={target}
            onValueChange={(v) => {
              setTarget(v as Target);
              if (problem === 'clinics') setProblem(null);
            }}
          >
            <Radio value="all">{text('annTargetAll')}</Radio>
            <Radio value="selected">{text('annTargetSome')}</Radio>
          </RadioGroup>
          {target === 'selected' && (
            <ClinicPicker
              value={clinicIds}
              onValueChange={(ids) => {
                setClinicIds(ids);
                if (ids.length > 0 && problem === 'clinics') setProblem(null);
              }}
              known={item?.clinics ?? []}
              hint={
                clinicIds.length === 0
                  ? text('pickerHintNone')
                  : text('annPickerHint', { count: clinicIds.length })
              }
              error={problem === 'clinics'}
            />
          )}
          {(problem === 'network' || problem === 'server') && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'loadFailedText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary" loading={busy}>
              {text(item === undefined ? 'annPublish' : 'annSaveEdit')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
