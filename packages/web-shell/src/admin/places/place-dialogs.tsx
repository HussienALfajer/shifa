// A place's rename and archive (slice A-02-09 checkpoint 3; drawing `A02Cities`, states `rename`,
// `archiveAsk`, `dup`; A-02 criteria 15, 24; contract rows "Places · rename", "· archive"): each
// states how many branches and clinics it reaches, counts only. A name that exists answers 409
// `place_name_taken` on the field; an archived or gone place closes it, the page names it and
// reads the list again; no connection keeps the input.
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
  Input,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { errorFacts } from '../../client.ts';
import { useShell } from '../../providers.tsx';
import { useText } from '../../text.ts';
import type { AdminNote } from '../a02.tsx';
import { PLACE_NAME_MAX, type Place } from './data.ts';

export function useReach(): (place: Place['place']) => { branches: string; clinics: string } {
  const text = useText();
  return (p) => ({
    branches: text('placesBranchCount', { count: p.branchCount }),
    // After «في»: the genitive dual («في عيادتين»).
    clinics: text('placesClinicCountIn', { count: p.clinicCount }),
  });
}

export function useStale(): AdminNote {
  const text = useText();
  return { tone: 'warning', title: text('placesStaleTitle'), text: text('placesStaleText') };
}

/** The 409 of a name that exists, in the words of the place. */
export function useTaken(): (
  target: Place | { kind: 'city' } | { kind: 'area'; city: { name: string } },
  name: string,
) => string {
  const text = useText();
  return (target, name) =>
    target.kind === 'area'
      ? text('placesTakenArea', { name, city: target.city.name })
      : text('placesTakenCity', { name });
}

export function RenameDialog({
  target,
  onDone,
  onClose,
}: {
  target: Place;
  onDone: (note: AdminNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const reach = useReach();
  const stale = useStale();
  const taken = useTaken();
  const [name, setName] = useState(target.place.name);
  const [problem, setProblem] = useState<'empty' | 'taken' | 'network' | 'server' | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const { id } = target.place;

  async function save() {
    if (inFlight.current) return;
    const next = name.trim();
    if (next === '') {
      setProblem('empty');
      return;
    }
    if (next === target.place.name) {
      onClose();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, error, response } =
        target.kind === 'city'
          ? await shell.api.PATCH('/platform/cities/{id}', {
              params: { path: { id } },
              body: { name: next },
            })
          : await shell.api.PATCH('/platform/areas/{id}', {
              params: { path: { id } },
              body: { name: next },
            });
      if (data) {
        onDone({ tone: 'success', title: text('placesRenamedTitle', { name: data.name }) });
        return;
      }
      const { code } = errorFacts(error);
      if (code === 'place_name_taken') setProblem('taken');
      else if (code === 'validation_failed') setProblem('empty');
      else if (response.status === 404) onDone(stale);
      else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const counts = reach(target.place);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={text('placesRenameTitle', { name: target.place.name })}
        closeLabel={text('close')}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            label={text('placesName')}
            required
            maxLength={PLACE_NAME_MAX}
            value={name}
            onValueChange={(v) => {
              setName(v);
              if (problem === 'empty' || problem === 'taken') setProblem(null);
            }}
            error={
              problem === 'empty'
                ? text('placesNameMissing')
                : problem === 'taken'
                  ? taken(target, name.trim())
                  : undefined
            }
          />
          <Callout tone="info">
            {target.place.branchCount === 0
              ? text('placesRenameNone')
              : text('placesRenameNote', counts)}
          </Callout>
          {(problem === 'network' || problem === 'server') && (
            <Callout
              tone="danger"
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'loadFailedText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary" loading={busy}>
              {text('save')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveDialog({
  target,
  onDone,
  onClose,
}: {
  target: Place;
  onDone: (note: AdminNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const reach = useReach();
  const stale = useStale();
  const [failure, setFailure] = useState('');
  const { id, name } = target.place;

  async function archive() {
    setFailure(`${text('unreachableTitle')}. ${text('loadFailedText')}`);
    const { data, error, response } =
      target.kind === 'city'
        ? await shell.api.POST('/platform/cities/{id}/archive', { params: { path: { id } } })
        : await shell.api.POST('/platform/areas/{id}/archive', { params: { path: { id } } });
    if (data) {
      onDone({
        tone: 'success',
        title: text('placesArchivedTitle', { name }),
        text: text('placesArchivedText'),
      });
      return;
    }
    if (errorFacts(error).code === 'place_archived' || response.status === 404) {
      onDone(stale);
      return;
    }
    setFailure(text('serverErrorText'));
    throw new Error(`archive answered ${String(response.status)}`);
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent
        tone="info"
        title={text('placesArchiveTitle', { name })}
        description={
          target.place.branchCount === 0
            ? text('placesArchiveNone')
            : text('placesArchiveText', reach(target.place))
        }
      >
        <AlertDialogCancel>{text('back')}</AlertDialogCancel>
        <AlertDialogAction variant="primary" errorText={failure} onAction={archive}>
          {text('placesArchive')}
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
