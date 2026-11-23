// Latin spellings of generated names (slice 0.4-12, P-N1; owner decision 2026-11-23): for a story
// or test that needs a person's name in Latin letters (an avatar in a mixed-direction line, an
// English screen). Each key is an entry of the Arabic lists, so a Latin name is a generated person
// written in Latin, never a name typed in. A small subset, in the common Syrian and Turkish
// spellings; add entries only from the Arabic lists.
import type { Random } from '../random.ts';

/** Given names of MALE_GIVEN_NAMES and FEMALE_GIVEN_NAMES, in Latin letters. */
export const LATIN_GIVEN_NAMES: ReadonlyMap<string, string> = new Map([
  ['محمد', 'Mohammad'],
  ['خالد', 'Khaled'],
  ['يوسف', 'Yousef'],
  ['سامر', 'Samer'],
  ['باسل', 'Basel'],
  ['ماهر', 'Maher'],
  ['طارق', 'Tareq'],
  ['فاطمة', 'Fatima'],
  ['مريم', 'Maryam'],
  ['ريم', 'Reem'],
  ['لينا', 'Lina'],
  ['ديما', 'Dima'],
  ['سلمى', 'Salma'],
  ['ياسمين', 'Yasmin'],
]);

/** Family names of FAMILY_NAMES and TURKMEN_FAMILY_NAMES, in Latin letters. */
export const LATIN_FAMILY_NAMES: ReadonlyMap<string, string> = new Map([
  ['الحلبي', 'Al-Halabi'],
  ['المصري', 'Al-Masri'],
  ['الشامي', 'Al-Shami'],
  ['الخطيب', 'Al-Khatib'],
  ['النجار', 'Al-Najjar'],
  ['قباني', 'Kabbani'],
  ['كيالي', 'Kayyali'],
  ['زيدان', 'Zeidan'],
  ['أوزتورك', 'Ozturk'],
  ['يلماز', 'Yilmaz'],
  ['كايا', 'Kaya'],
]);

export interface LatinPersonName {
  /** Given and family name as the Arabic lists write them. */
  readonly arabic: string;
  /** The same name in Latin letters. */
  readonly latin: string;
}

const GIVEN = [...LATIN_GIVEN_NAMES];
const FAMILY = [...LATIN_FAMILY_NAMES];

/** A generated given and family name, in Arabic and in Latin letters. */
export const generateLatinPersonName = (random: Random): LatinPersonName => {
  const [givenAr, givenLa] = random.pick(GIVEN);
  const [familyAr, familyLa] = random.pick(FAMILY);
  return { arabic: `${givenAr} ${familyAr}`, latin: `${givenLa} ${familyLa}` };
};
