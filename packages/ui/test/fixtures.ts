// Synthetic people for component tests and stories (slice 0.4-04): names from the generator in
// @shifa/testing only, never real ones (.claude/rules/patient-data.md). Seeds are fixed, so the
// same names come back on every run and in every screenshot.
import { createRandom, generatePersonName } from '@shifa/testing';

export interface Person {
  /** A stable id, like a record number. */
  id: string;
  /** Given and family name, as a list shows it. */
  name: string;
}

/**
 * `count` people whose names start with different letters, so typeahead tests can name one by
 * its first letter. `prefix` (for example «د.») goes before each name.
 */
export function people(
  count: number,
  {
    seed = 7,
    prefix = '',
    firstId = 1001,
  }: { seed?: number; prefix?: string; firstId?: number } = {},
): Person[] {
  const random = createRandom(seed);
  const out: Person[] = [];
  const firstLetters = new Set<string>();
  for (let i = 0; out.length < count && i < 500; i++) {
    const n = generatePersonName(random, {
      sex: i % 2 === 0 ? 'female' : 'male',
      adult: true,
      region: i % 3 === 0 ? 'azaz' : 'aleppo',
    });
    const letter = n.given.charAt(0);
    if (firstLetters.has(letter)) continue;
    firstLetters.add(letter);
    out.push({
      id: String(firstId + out.length),
      name: `${prefix}${n.given} ${n.family}`,
    });
  }
  if (out.length < count) throw new Error(`only ${String(out.length)} distinct first letters`);
  return out;
}

/** Four doctors, «د.» before each name. */
export const DOCTORS = people(4, { seed: 11, prefix: 'د. ' });

/**
 * Patients for a search: three whose given names share their first two letters, and others.
 * The shared start is `PATIENT_QUERY`.
 */
export function patientsSharing(): { query: string; matching: Person[]; others: Person[] } {
  const random = createRandom(23);
  const byStart = new Map<string, Person[]>();
  for (let i = 0; i < 800; i++) {
    const n = generatePersonName(random, {
      sex: i % 2 === 0 ? 'female' : 'male',
      adult: true,
      region: 'aleppo',
    });
    const start = n.given.slice(0, 2);
    const list = byStart.get(start) ?? [];
    const name = `${n.given} ${n.family}`;
    if (!list.some((p) => p.name.split(' ')[0] === n.given)) {
      list.push({ id: String(1000 + i), name });
    }
    byStart.set(start, list);
  }
  const [query, list] = [...byStart].sort((a, b) => b[1].length - a[1].length)[0] ?? ['', []];
  const matching = list.slice(0, 3);
  const others = [...byStart]
    .filter(([start]) => start !== query && !start.startsWith(query.charAt(0)))
    .slice(0, 3)
    .map(([, l]) => l[0])
    .filter((p): p is Person => p !== undefined);
  return { query, matching, others };
}
