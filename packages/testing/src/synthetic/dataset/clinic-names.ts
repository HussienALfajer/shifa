/**
 * Clinic names come only from these patterns filled with list entries, never from a real clinic
 * (spec 0.2-08 criterion 14). The `no-real-data` test holds the same pattern set.
 */

import { FAMILY_NAMES, TURKMEN_FAMILY_NAMES } from '../names/lists.ts';
import type { PersonName } from '../names/person-name.ts';
import type { Random } from '../random.ts';
import type { City, TenantKind } from './model.ts';

const FAMILY_PATTERNS: readonly ((family: string) => string)[] = [
  (family) => `مركز ${family} لطب الأسنان`,
  (family) => `مجمع ${family} الطبي`,
  (family) => `مركز ${family} الطبي التخصصي`,
];

/** Share of Azaz clinic names built on a Turkmen family name. */
const AZAZ_TURKMEN_CLINIC_SHARE = 0.3;

/** A solo clinic carries its doctor's name; larger tenants a family-name pattern. */
export const clinicName = (
  random: Random,
  kind: TenantKind,
  city: City,
  doctor: PersonName,
): string => {
  if (kind === 'solo') return `عيادة د. ${doctor.given} ${doctor.family}`;
  const turkmen = city === 'azaz' && random.chance(AZAZ_TURKMEN_CLINIC_SHARE);
  const family = random.pick(turkmen ? TURKMEN_FAMILY_NAMES : FAMILY_NAMES);
  return random.pick(FAMILY_PATTERNS)(family);
};

const BRANCH_NAMES = ['الفرع الرئيسي', 'الفرع الثاني', 'الفرع الثالث', 'الفرع الرابع'] as const;

export const branchName = (index: number): string =>
  BRANCH_NAMES[index] ?? `الفرع ${String(index + 1)}`;
