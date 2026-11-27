// The places' read (slice A-02-09; contract row "Places · list"): GET
// /platform/cities?includeArchived=, keyed under `['platform', …]`, never retried or refetched by
// itself. The search runs on the client with the shared Arabic fold (`matchesWordStart`, as
// Combobox): a city whose name matches keeps all its areas; otherwise only the matching areas.
import type { Schemas } from '@shifa/api-client-ts';
import { matchesWordStart } from '@shifa/contracts/fold-arabic';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ShellClient } from '../../client.ts';
import { useShell } from '../../providers.tsx';

export type City = Schemas['City'];
export type Area = Schemas['Area'];
export type Place = { kind: 'city'; place: City } | { kind: 'area'; place: Area; city: City };

export const citiesKey = (archived: boolean) => ['platform', 'cities', archived] as const;

export function citiesQuery(shell: ShellClient, archived: boolean) {
  return queryOptions({
    queryKey: citiesKey(archived),
    queryFn: async (): Promise<City[]> => {
      const { data } = await shell.api.GET('/platform/cities', {
        params: { query: archived ? { includeArchived: 'true' } : {} },
      });
      if (!data) throw new Error('GET /platform/cities failed');
      return data.cities;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCities(archived: boolean) {
  const { shell } = useShell();
  return useQuery({ ...citiesQuery(shell, archived), placeholderData: (previous) => previous });
}

/** The cities a search keeps, each with the areas it keeps. */
export function searchPlaces(cities: readonly City[], query: string): City[] {
  if (query.trim() === '') return [...cities];
  const found: City[] = [];
  for (const city of cities) {
    if (matchesWordStart(city.name, query)) {
      found.push(city);
      continue;
    }
    const areas = city.areas.filter((a) => matchesWordStart(a.name, query));
    if (areas.length > 0) found.push({ ...city, areas });
  }
  return found;
}

/** The contract's name, 1–100 characters once trimmed. */
export const PLACE_NAME_MAX = 100;
