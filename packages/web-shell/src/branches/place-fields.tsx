// A branch's city and area (slice A-02-10; board `A02cBranchPlace`, states `empty`, `city`,
// `areaTyping`, `areaNone`, `archivedValue`, `cards`; contract rows "Branch dialog · city and
// area", "· save" and "Branch cards"): GET /clinic/places as two Comboboxes with the shared Arabic
// fold; the area waits for its city and follows it (a new city clears it); an archived place the
// branch holds stays chosen, listed with «(مؤرشفة)» and named under the field, never offered to
// another branch. The cards read «حلب · الشهباء», Badge «منطقة مؤرشفة», or «لم تُحدَّد المدينة».
import type { Schemas } from '@shifa/api-client-ts';
import { Badge, Combobox, type ComboboxItem, Icon } from '@shifa/ui';
import { useQuery } from '@tanstack/react-query';
import { useSignedIn } from '../account/data.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';

type ClinicCity = Schemas['ClinicCity'];
interface Place {
  id: string;
  name: string;
  archived: boolean;
}

/** A branch as the cards and the dialog read it; `city`/`area` absent on older answers. */
export interface PlacedBranch {
  city?: Place | null;
  area?: Place | null;
}

export const placesKey = (tenantId: string) => ['clinic', tenantId, 'places'] as const;

export function useClinicPlaces() {
  const { shell } = useShell();
  const tenantId = useSignedIn()?.tenantId ?? '';
  return useQuery({
    queryKey: placesKey(tenantId),
    queryFn: async (): Promise<ClinicCity[]> => {
      const { data } = await shell.api.GET('/clinic/places');
      const cities = (data as { cities?: unknown } | undefined)?.cities;
      if (!Array.isArray(cities)) throw new Error('GET /clinic/places failed');
      return cities as ClinicCity[];
    },
    enabled: tenantId !== '',
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function BranchPlaceLine({ branch }: { branch: PlacedBranch }) {
  const text = useText();
  const city = branch.city ?? null;
  const area = branch.area ?? null;
  return (
    <span className="flex flex-wrap items-center gap-2 text-data leading-body">
      <Icon name="buildings" />
      {city === null ? (
        <span className="text-text-muted">{text('placeNoCity')}</span>
      ) : (
        // Names only, joined by the middle dot the cards use for every pair («حلب · الشهباء»).
        <span>{area ? `${city.name} · ${area.name}` : city.name}</span>
      )}
      {city?.archived === true && (
        <Badge tone="neutral" icon="archive">
          {text('placeCityArchivedBadge')}
        </Badge>
      )}
      {area?.archived === true && (
        <Badge tone="neutral" icon="archive">
          {text('placeAreaArchivedBadge')}
        </Badge>
      )}
    </span>
  );
}

/** Offered places, and the archived one this branch holds (chosen, not offered anew). */
function itemsOf(places: readonly Place[], held: Place | null, label: (p: Place) => string) {
  const items: ComboboxItem[] = [];
  for (const p of places) {
    if (!p.archived) items.push({ value: p.id, label: p.name });
    else if (p.id === held?.id) items.push({ value: p.id, label: label(p), disabled: true });
  }
  if (held?.archived && !items.some((i) => i.value === held.id)) {
    items.unshift({ value: held.id, label: label(held), disabled: true });
  }
  return items;
}

export function PlaceFields({
  cityId,
  areaId,
  held,
  onChange,
  cityError,
  areaError,
}: {
  cityId: string | null;
  areaId: string | null;
  /** What the branch holds now (an edit); its archived places stay. */
  held: PlacedBranch;
  onChange: (next: { cityId: string | null; areaId: string | null }) => void;
  cityError?: string | undefined;
  areaError?: string | undefined;
}) {
  const text = useText();
  const { data: cities = [] } = useClinicPlaces();
  const archivedLabel = (p: Place) => text('placeArchivedOption', { name: p.name });
  const heldCity = held.city ?? null;
  const heldArea = held.area ?? null;
  const city: Place | null =
    cities.find((c) => c.id === cityId) ?? (heldCity?.id === cityId ? heldCity : null);
  const areas = city ? (cities.find((c) => c.id === city.id)?.areas ?? []) : [];
  const keptArea = heldArea?.archived && heldArea.id === areaId ? heldArea : null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Combobox
        label={text('placeCity')}
        hint={text('branchOptional')}
        placeholder={text('placeCitySearch')}
        clearLabel={text('placeClear')}
        emptyMessage={text('placeCityNone')}
        items={itemsOf(cities, heldCity, archivedLabel)}
        value={cityId}
        onValueChange={(next) => {
          // The area belongs to its city: a new city clears it.
          onChange({ cityId: next, areaId: next === cityId ? areaId : null });
        }}
        error={cityError}
      />
      <Combobox
        key={city?.id ?? 'none'}
        label={text('placeArea')}
        hint={
          city === null
            ? text('placeAreaFirst')
            : keptArea
              ? text('placeArchivedHeld', { name: keptArea.name })
              : text('branchOptional')
        }
        placeholder={city ? text('placeAreaSearch', { city: city.name }) : undefined}
        clearLabel={text('placeClear')}
        emptyMessage={text('placeAreaNone', { city: city?.name ?? '' })}
        items={itemsOf(areas, keptArea, archivedLabel)}
        value={areaId}
        disabled={city === null}
        onValueChange={(next) => {
          onChange({ cityId, areaId: next });
        }}
        error={areaError}
      />
    </div>
  );
}
