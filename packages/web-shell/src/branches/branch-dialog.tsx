// «إضافة فرع» and «تعديل» (slice A-01-08 checkpoint 4; prototype `Team08`; the `POST`, `PATCH
// /branches` row of the slice's table; A-01b criterion 9): the name required before sending,
// address and phone optional. An edit sends only what changed (a cleared address or phone as
// null) and «حفظ» waits for a change. 400 `body.phone` under the phone; 409 `branch_archived`
// and 404 close it and are named on the page, the list read again; no connection keeps the input.
// A-02-10 (board `A02cBranchPlace`): the city and area (place-fields.tsx), sent only when changed;
// 409 `place_archived` and 400 on `body.cityId`/`body.areaId` are field errors; 409
// `limit_reached` (the branch limit filled meanwhile) is named in the dialog.

import type { CommonKey } from '@shifa/i18n';
import {
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  Input,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { phoneRefused } from '../admin/phone.ts';
import { limitReachedOf } from '../capabilities.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { type Branch, NAME_MAX, PHONE_MAX } from '../team/data.ts';
import { useLimitSentence } from '../team/limit-parts.tsx';
import { useText } from '../text.ts';
import type { PageNote } from './branch-note.tsx';
import { type PlacedBranch, PlaceFields } from './place-fields.tsx';

const ADDRESS_MAX = 300;

type Problem = 'name' | 'phone' | 'network' | 'server' | null;
type PlaceProblem = { field: 'city' | 'area'; word: CommonKey } | null;

/** A refusal about the city or the area, as a field error (A-02-06's codes). */
function placeRefused(error: unknown): PlaceProblem {
  const body = error as
    | { error?: { code?: unknown; place?: unknown; details?: unknown } }
    | null
    | undefined;
  const e = body?.error;
  if (e?.code === 'place_archived') {
    return e.place === 'city'
      ? { field: 'city', word: 'placeCityArchived' }
      : { field: 'area', word: 'placeAreaArchived' };
  }
  if (e?.code !== 'validation_failed' || !Array.isArray(e.details)) return null;
  for (const d of e.details as { path?: unknown; code?: unknown }[]) {
    if (d.path === 'body.areaId') {
      return {
        field: 'area',
        word: d.code === 'area_not_in_city' ? 'placeAreaNotInCity' : 'placeUnknown',
      };
    }
    if (d.path === 'body.cityId') return { field: 'city', word: 'placeUnknown' };
  }
  return null;
}

/** The typed value, trimmed; empty is null (no address, no phone). */
const valueOf = (typed: string) => (typed.trim() === '' ? null : typed.trim());

export function BranchDialog({
  branch,
  onSaved,
  onRefused,
  onClose,
}: {
  /** The branch edited; none to add. */
  branch?: Branch;
  onSaved: (saved: Branch, added: boolean) => void;
  /** A refusal the dialog cannot fix: it closes and the page names it. */
  onRefused: (note: PageNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const placed = (branch ?? {}) as PlacedBranch;
  const heldCityId = placed.city?.id ?? null;
  const heldAreaId = placed.area?.id ?? null;
  const [place, setPlace] = useState({ cityId: heldCityId, areaId: heldAreaId });
  const [placeProblem, setPlaceProblem] = useState<PlaceProblem>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<string | null>(null);
  const sentence = useLimitSentence();
  const inFlight = useRef(false);

  const changes = {
    ...(name.trim() !== branch?.name ? { name: name.trim() } : {}),
    ...(valueOf(address) !== (branch?.address ?? null) ? { address: valueOf(address) } : {}),
    ...(valueOf(phone) !== (branch?.phone ?? null) ? { phone: valueOf(phone) } : {}),
    // A held place unchanged is not sent: an archived one stays without being chosen anew.
    ...(place.cityId !== heldCityId ? { cityId: place.cityId } : {}),
    ...(place.areaId !== heldAreaId || place.cityId !== heldCityId ? { areaId: place.areaId } : {}),
  };
  const changed = Object.keys(changes).length > 0;

  async function send() {
    if (inFlight.current) return;
    if (name.trim() === '') {
      setProblem('name');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    setPlaceProblem(null);
    setLimit(null);
    try {
      const answer =
        branch === undefined
          ? await shell.api.POST('/branches', {
              body: {
                name: name.trim(),
                ...(valueOf(address) === null ? {} : { address: valueOf(address) }),
                ...(valueOf(phone) === null ? {} : { phone: valueOf(phone) }),
                ...(place.cityId === null ? {} : { cityId: place.cityId }),
                ...(place.areaId === null ? {} : { areaId: place.areaId }),
              },
            })
          : await shell.api.PATCH('/branches/{id}', {
              params: { path: { id: branch.id } },
              body: changes,
            });
      const { data, error, response } = answer;
      if (data) {
        onSaved(data, branch === undefined);
        return;
      }
      const { code } = errorFacts(error);
      const onPlace = placeRefused(error);
      const reached = limitReachedOf(error);
      if (onPlace) setPlaceProblem(onPlace);
      else if (reached) setLimit(sentence(reached));
      else if (phoneRefused(error, 'body.phone')) setProblem('phone');
      else if (code === 'branch_archived') {
        onRefused({
          tone: 'warning',
          title: text('branchGoneArchivedTitle'),
          text: text('branchGoneArchivedText'),
        });
      } else if (response.status === 404) {
        onRefused({
          tone: 'warning',
          title: text('branchGoneTitle'),
          text: text('branchGoneText'),
        });
      } else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const keepProblem = problem === 'network' || problem === 'server';
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={
          branch === undefined
            ? text('branchAddTitle')
            : text('branchEditTitle', { name: branch.name })
        }
        closeLabel={text('close')}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Input
            label={text('branchName')}
            maxLength={NAME_MAX}
            value={name}
            onValueChange={(v) => {
              setName(v);
              if (problem === 'name') setProblem(null);
            }}
            error={problem === 'name' ? text('branchNameMissing') : undefined}
          />
          <Input
            label={text('branchAddress')}
            hint={text('branchOptional')}
            maxLength={ADDRESS_MAX}
            value={address}
            onValueChange={setAddress}
          />
          <PlaceFields
            cityId={place.cityId}
            areaId={place.areaId}
            held={placed}
            onChange={(next) => {
              setPlace(next);
              setPlaceProblem(null);
            }}
            cityError={placeProblem?.field === 'city' ? text(placeProblem.word) : undefined}
            areaError={placeProblem?.field === 'area' ? text(placeProblem.word) : undefined}
          />
          <Input
            label={text('branchPhone')}
            hint={text('branchPhoneHint')}
            maxLength={PHONE_MAX}
            type="tel"
            dir="ltr"
            value={phone}
            onValueChange={(v) => {
              setPhone(v);
              if (problem === 'phone') setProblem(null);
            }}
            error={problem === 'phone' ? text('phoneInvalid') : undefined}
          />
          {limit !== null && (
            <Callout tone="danger" title={text('limitBranchNotAdded')}>
              {limit}
            </Callout>
          )}
          {keepProblem && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'branchNetworkText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={branch !== undefined && !changed}
            >
              {branch === undefined ? text('branchAddSubmit') : text('save')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
