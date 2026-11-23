// Synthetic people for component tests and stories (slice 0.4-04): names from the generator in
// @shifa/testing only, never real ones (.claude/rules/patient-data.md). Seeds are fixed, so the
// same names come back on every run and in every screenshot.
import { createRandom, generatePersonName, generatePhone, type PhoneCountry } from '@shifa/testing';

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

/**
 * `count` synthetic mobile numbers in E.164 (slice 0.4-10 F2): from the generator only, so each
 * carries its `00` marker and `scripts/test/no-real-phones.test.mjs` lets it through.
 */
export function phones(
  count: number,
  { seed = 410, country = 'SY' }: { seed?: number; country?: PhoneCountry } = {},
): string[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => generatePhone(random, country));
}

/**
 * A number in the national form a patient types: `0930 012 345` (Syria, 4-3-3) or
 * `0530 001 23 45` (Turkey, 4-3-2-2).
 */
export function nationalPhone(e164: string): string {
  const syrian = e164.startsWith('+963');
  const national = `0${e164.slice(syrian ? 4 : 3)}`;
  const groups = syrian ? [4, 3, 3] : [4, 3, 2, 2];
  let at = 0;
  return groups
    .map((size) => {
      const part = national.slice(at, at + size);
      at += size;
      return part;
    })
    .join(' ');
}

/** One synthetic number for a single field, in national form (`0930 024 973`). */
export const PHONE = nationalPhone(phones(1)[0] ?? '');

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

/**
 * The first generated person whose given name passes `test` (slice 0.4-12): a name that starts
 * with «أ» or ends with «ة», for the Arabic folding tests, without typing one in.
 */
export function personWhere(
  test: (given: string) => boolean,
  { seed = 40, id = '2001' }: { seed?: number; id?: string } = {},
): Person {
  const random = createRandom(seed);
  for (let i = 0; i < 2000; i++) {
    const n = generatePersonName(random, {
      sex: i % 2 === 0 ? 'female' : 'male',
      adult: true,
      region: i % 3 === 0 ? 'azaz' : 'aleppo',
    });
    if (test(n.given)) return { id, name: `${n.given} ${n.family}` };
  }
  throw new Error('no generated name passes the test');
}
