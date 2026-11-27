// «المدن والمناطق» (slice A-02-09 checkpoint 3; drawing `A02Cities` on "Shifa Screens · Admin
// web", approved in A-02-01; A-02 criteria 15, 24; contract rows "Places · list", "· add", "·
// restore"): the cities, and the areas of the chosen one, each with how many branches hold it, in
// how many clinics, with how many doctors (counts only); add a city or an area of the chosen city;
// rename and archive from each place's menu; «عرض المؤرشفة» reads the archived ones too, each with
// «استعادة»; the search runs on the client with the Arabic fold. States: none yet, no match, a
// city without areas, loading, failed.
import { Button, Card, EmptyState, Input, SkeletonGroup, SkeletonText, Switch } from '@shifa/ui';
import { type ReactNode, useRef, useState } from 'react';
import { useShell } from '../../providers.tsx';
import { useText } from '../../text.ts';
import { type AdminNote, NoteCallout } from '../a02.tsx';
import { AdminFrame } from '../admin-frame.tsx';
import { type City, PLACE_NAME_MAX, type Place, searchPlaces, useCities } from './data.ts';
import { ArchiveDialog, RenameDialog, useStale } from './place-dialogs.tsx';
import { AddForm, PlaceRow, useMeta } from './place-parts.tsx';

type Open = { kind: 'rename' | 'archive'; target: Place } | null;

const liveAreas = (c: City) => c.areas.filter((a) => a.archivedAt === null).length;

export function PlacesPage() {
  const text = useText();
  const { shell } = useShell();
  const stale = useStale();
  const meta = useMeta();
  const [archived, setArchived] = useState(false);
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [note, setNote] = useState<AdminNote | null>(null);
  const restoring = useRef(new Set<string>());
  const { data, isPending, isError, refetch } = useCities(archived);
  const done = (next: AdminNote) => {
    setOpen(null);
    setNote(next);
    void refetch();
  };
  const goneStale = () => {
    done(stale);
  };
  const close = () => {
    setOpen(null);
  };

  async function restore(target: Place) {
    const { id, name } = target.place;
    // One restore per place at a time: a double click would answer 409 and hide «استُعيدت».
    if (restoring.current.has(id)) return;
    restoring.current.add(id);
    setNote(null);
    try {
      const { data: back, response } =
        target.kind === 'city'
          ? await shell.api.POST('/platform/cities/{id}/restore', { params: { path: { id } } })
          : await shell.api.POST('/platform/areas/{id}/restore', { params: { path: { id } } });
      if (back) {
        done({
          tone: 'success',
          title: text('placesRestoredTitle', { name }),
          text: text('placesRestoredText'),
        });
      } else if (response.status === 404 || response.status === 409) done(stale);
      else {
        setNote({
          tone: 'danger',
          title: text('actionFailedTitle'),
          text: text('serverErrorText'),
        });
      }
    } catch {
      setNote({ tone: 'danger', title: text('unreachableTitle'), text: text('loadFailedText') });
    } finally {
      restoring.current.delete(id);
    }
  }

  const all = data ?? [];
  const cities = searchPlaces(all, typed);
  const city = cities.find((c) => c.id === chosen) ?? cities[0];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        aria-label={text('placesSearch')}
        placeholder={text('placesSearch')}
        startIcon="magnifying-glass"
        maxLength={PLACE_NAME_MAX}
        value={typed}
        onValueChange={setTyped}
        className="max-w-(--shifa-width-100) flex-1"
      />
      <span className="flex-1" />
      <Switch checked={archived} onCheckedChange={setArchived}>
        {text('placesShowArchived')}
      </Switch>
    </div>
  );

  let body: ReactNode;
  if (isPending) {
    body = (
      <Card className="p-4">
        <SkeletonGroup label={text('loading')}>
          <SkeletonText lines={6} />
        </SkeletonGroup>
      </Card>
    );
  } else if (isError && !data) {
    body = (
      <Card className="p-4">
        <EmptyState
          icon="wifi-slash"
          title={text('loadFailedTitle')}
          description={text('loadFailedText')}
          headingLevel={2}
          actions={
            <Button variant="secondary" onClick={() => void refetch()}>
              {text('retry')}
            </Button>
          }
        />
      </Card>
    );
  } else if (all.length === 0) {
    // The switch stays: with every city archived, «عرض المؤرشفة» is how they are restored.
    body = (
      <>
        {toolbar}
        <Card className="flex flex-col gap-4 p-4">
          <EmptyState
            art="star"
            title={text('placesEmptyTitle')}
            description={text('placesEmptyText')}
            headingLevel={2}
          />
          <AddForm
            label={text('placesNewCity')}
            submit={text('placesAddCity')}
            onAdded={done}
            onStale={goneStale}
          />
        </Card>
      </>
    );
  } else {
    body = (
      <>
        {toolbar}
        {city === undefined ? (
          <Card className="p-4">
            <EmptyState
              icon="magnifying-glass"
              title={text('placesNoMatchTitle')}
              description={text('placesNoMatchText')}
              headingLevel={2}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="m-0 text-heading-sm font-semibold">{text('placesCities')}</h2>
              <div className="flex flex-col">
                {cities.map((c) => (
                  <PlaceRow
                    key={c.id}
                    target={{ kind: 'city', place: c }}
                    selected={c.id === city.id}
                    meta={meta(c, liveAreas(all.find((x) => x.id === c.id) ?? c))}
                    head={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ms-2 font-semibold text-text-default"
                        aria-pressed={c.id === city.id}
                        onClick={() => {
                          setChosen(c.id);
                        }}
                      >
                        {c.name}
                      </Button>
                    }
                    onOpen={(kind) => {
                      setNote(null);
                      setOpen({ kind, target: { kind: 'city', place: c } });
                    }}
                    onRestore={() => void restore({ kind: 'city', place: c })}
                  />
                ))}
              </div>
              <AddForm
                label={text('placesNewCity')}
                submit={text('placesAdd')}
                onAdded={done}
                onStale={goneStale}
              />
            </Card>
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="m-0 text-heading-sm font-semibold">
                {text('placesAreasOf', { name: city.name })}
              </h2>
              {city.areas.length === 0 ? (
                <EmptyState
                  art="jasmine"
                  title={text('placesAreasEmptyTitle')}
                  description={text('placesAreasEmptyText')}
                  headingLevel={3}
                />
              ) : (
                <div className="flex flex-col">
                  {city.areas.map((a) => (
                    <PlaceRow
                      key={a.id}
                      target={{ kind: 'area', place: a, city }}
                      meta={meta(a)}
                      head={<span className="font-medium">{a.name}</span>}
                      onOpen={(kind) => {
                        setNote(null);
                        setOpen({ kind, target: { kind: 'area', place: a, city } });
                      }}
                      onRestore={() => void restore({ kind: 'area', place: a, city })}
                    />
                  ))}
                </div>
              )}
              {city.archivedAt === null && (
                <AddForm
                  key={city.id}
                  label={text('placesNewArea')}
                  submit={text('placesAdd')}
                  city={city}
                  onAdded={done}
                  onStale={goneStale}
                />
              )}
            </Card>
          </div>
        )}
      </>
    );
  }

  return (
    <AdminFrame title={text('placesTitle')} description={text('placesText')}>
      <NoteCallout note={note} />
      {body}
      {open?.kind === 'rename' && (
        <RenameDialog target={open.target} onDone={done} onClose={close} />
      )}
      {open?.kind === 'archive' && (
        <ArchiveDialog target={open.target} onDone={done} onClose={close} />
      )}
    </AdminFrame>
  );
}
