// The parts of «المدن والمناطق» (slice A-02-09 checkpoint 3; drawing `A02Cities`): a place's row
// (its name, «مؤرشفة», its counts, the menu with «إعادة التسمية» and «أرشفة», or «استعادة»),
// the line of counts, and the field that adds a city or an area of the chosen city (contract row
// "Places · add": 409 `place_name_taken` on the field, «“…” موجودة في حلب»).
import { Badge, Button, Input, Menu, MenuContent, MenuItem, MenuTrigger } from '@shifa/ui';
import { type ReactNode, useState } from 'react';
import { dayDate } from '../../auth/dates.ts';
import { errorFacts } from '../../client.ts';
import { useShell } from '../../providers.tsx';
import { useText } from '../../text.ts';
import type { AdminNote } from '../a02.tsx';
import { type City, PLACE_NAME_MAX, type Place } from './data.ts';
import { useTaken } from './place-dialogs.tsx';

/** «9 مناطق · 14 فرعًا · 11 عيادة · 34 طبيبًا»; «لا فروع» alone when no branch holds it. */
export function useMeta(): (place: Place['place'], areas?: number) => string {
  const text = useText();
  return (p, areas) => {
    const parts: string[] = [];
    if (p.archivedAt !== null) {
      parts.push(text('placesArchivedSince', { date: dayDate(Date.parse(p.archivedAt)) }));
    }
    if (areas !== undefined) parts.push(text('placesAreaCount', { count: areas }));
    parts.push(text('placesBranchCount', { count: p.branchCount }));
    if (p.branchCount > 0) {
      parts.push(text('placesClinicCount', { count: p.clinicCount }));
      parts.push(text('placesDoctorCount', { count: p.doctorCount }));
    }
    return parts.join(' · ');
  };
}

/** Add a city, or an area of the chosen city: one field and «إضافة». */
export function AddForm({
  label,
  submit,
  city,
  onAdded,
  onStale,
}: {
  label: string;
  submit: string;
  /** The city an area goes to; none to add a city. */
  city?: City;
  onAdded: (note: AdminNote) => void;
  onStale: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const taken = useTaken();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  async function add() {
    const next = name.trim();
    if (next === '') {
      setError(text('placesNameMissing'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const {
        data,
        error: refused,
        response,
      } = city === undefined
        ? await shell.api.POST('/platform/cities', { body: { name: next } })
        : await shell.api.POST('/platform/cities/{id}/areas', {
            params: { path: { id: city.id } },
            body: { name: next },
          });
      if (data) {
        setName('');
        onAdded({ tone: 'success', title: text('placesAddedTitle', { name: data.name }) });
        return;
      }
      const { code } = errorFacts(refused);
      if (code === 'place_name_taken') {
        setError(taken(city === undefined ? { kind: 'city' } : { kind: 'area', city }, next));
      } else if (code === 'validation_failed') setError(text('placesNameMissing'));
      else if (response.status === 404) onStale();
      else setError(text('serverErrorText'));
    } catch {
      setError(text('loadFailedText'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      noValidate
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <Input
        aria-label={label}
        placeholder={label}
        maxLength={PLACE_NAME_MAX}
        value={name}
        onValueChange={(v) => {
          setName(v);
          setError(undefined);
        }}
        error={error}
        className="flex-1"
      />
      <Button type="submit" variant="secondary" startIcon="plus" loading={busy}>
        {submit}
      </Button>
    </form>
  );
}

export function PlaceRow({
  target,
  selected = false,
  meta,
  head,
  onOpen,
  onRestore,
}: {
  target: Place;
  /** The chosen city, whose areas are shown: the selection colour, as drawn. */
  selected?: boolean;
  meta: string;
  /** The city's name as a button that chooses it; an area's name as text. */
  head: ReactNode;
  onOpen: (kind: 'rename' | 'archive') => void;
  onRestore: () => void;
}) {
  const text = useText();
  const { name, archivedAt } = target.place;
  return (
    <div
      data-row
      className={`flex items-center gap-2 rounded-control border-t border-border-default px-3 py-2 text-data leading-body first:border-t-0 ${selected ? 'bg-selection-subtle' : ''}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          {head}
          {archivedAt !== null && (
            <Badge tone="neutral" size="sm" icon="archive">
              {text('placesArchivedBadge')}
            </Badge>
          )}
        </span>
        <span className="text-caption text-text-muted">{meta}</span>
      </div>
      {archivedAt === null ? (
        <Menu
          onAction={(v) => {
            onOpen(v as 'rename' | 'archive');
          }}
        >
          <MenuTrigger
            icon="dots"
            aria-label={text('placesActions', { name })}
            variant="ghost"
            size="sm"
          />
          <MenuContent>
            <MenuItem value="rename" icon="pencil">
              {text('placesRename')}
            </MenuItem>
            <MenuItem value="archive" icon="archive">
              {text('placesArchive')}
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          aria-label={text('placesRestoreOf', { name })}
          onClick={onRestore}
        >
          {text('placesRestore')}
        </Button>
      )}
    </div>
  );
}
