// The S6 test set (criterion 3): every clip a provider must speak, and the ten announcements
// joined from clips at play time (VOX-01, VOX-03). The same text goes to every provider.
import { MALE_GIVEN_NAMES } from '@shifa/testing';
import { CHOSEN_NUMBERS, NAMES } from './data.ts';
import { numberToArabicWords } from './numbers.ts';

export type Category = 'chime' | 'number' | 'room' | 'doctor' | 'name' | 'name-plain' | 'pre-round';

export interface Clip {
  id: string;
  category: Category;
  /** Plain text sent to the provider; empty for the synthetic chime. */
  text: string;
}

export interface Announcement {
  id: string;
  /** chime → name → number → room */
  clipIds: string[];
}

export interface TestSet {
  kind: SetKind;
  clips: Clip[];
  announcements: Announcement[];
  /** Code points of every text: what a vendor that bills per character counts. */
  characters: number;
}

export type SetKind = 'full' | 'pre-round';

export const TASHKEEL_RE = /[ً-ٰٟ]/u;
const TASHKEEL_ALL = /[ً-ٰٟ]/gu;

export function stripTashkeel(text: string): string {
  return text.replace(TASHKEEL_ALL, '');
}

/** Two synthetic doctors from @shifa/testing that are not in names.json (no real person). */
export const DOCTOR_FIRST_NAMES = ['رياض', 'فراس'] as const;
for (const name of DOCTOR_FIRST_NAMES) {
  if (!MALE_GIVEN_NAMES.includes(name)) {
    throw new Error(`doctor name not in @shifa/testing: ${name}`);
  }
}

export const ROOM_COUNT = 5;

export const numberClipId = (n: number) => `number-${String(n).padStart(3, '0')}`;
export const roomClipId = (room: number) => `room-${String(room)}`;
export const nameClipId = (id: string) => `name-${id}`;
export const plainNameClipId = (id: string) => `name-plain-${id}`;

/** The room phrase recorded in the slice file: "إلى العيادة رقم {words}". */
export const roomText = (room: number) => `إلى العيادة رقم ${numberToArabicWords(room)}`;
export const numberText = (n: number) => `الرقم ${numberToArabicWords(n)}`;

/** Ten announcements: name, number and room picked to mix sexes, origins and grammar cases. */
const ANNOUNCEMENTS: [nameId: string, number: number, room: number][] = [
  ['m01', 1, 1],
  ['f01', 11, 2],
  ['m12', 21, 3],
  ['f14', 102, 4],
  ['m27', 111, 5],
  ['f30', 200, 1],
  ['m41', 12, 2],
  ['f44', 999, 3],
  ['m48', 215, 4],
  ['f50', 64, 5],
];

const PRE_ROUND = [
  'الرقم مئة وأحد عشر، إلى العيادة رقم ثلاثة',
  'الرقم اثنا عشر، إلى العيادة رقم واحد',
  'إِبْرَاهِيم، الرقم تسعمئة وتسعة وتسعون',
  'فَاطِمَة، الرقم مئتان وخمسة عشر، إلى العيادة رقم خمسة',
  'عيادة الدكتور رياض',
];

function withCharacters(kind: SetKind, clips: Clip[], announcements: Announcement[]): TestSet {
  const characters = clips.reduce((sum, c) => sum + Array.from(c.text).length, 0);
  return { kind, clips, announcements, characters };
}

export function buildTestSet(kind: SetKind): TestSet {
  if (kind === 'pre-round') {
    const clips = PRE_ROUND.map((text, i) => ({
      id: `pre-${String(i + 1)}`,
      category: 'pre-round' as const,
      text,
    }));
    return withCharacters(kind, clips, []);
  }
  const clips: Clip[] = [{ id: 'chime', category: 'chime', text: '' }];
  for (const { n } of CHOSEN_NUMBERS) {
    clips.push({ id: numberClipId(n), category: 'number', text: numberText(n) });
  }
  for (let room = 1; room <= ROOM_COUNT; room += 1) {
    clips.push({ id: roomClipId(room), category: 'room', text: roomText(room) });
  }
  DOCTOR_FIRST_NAMES.forEach((name, i) => {
    clips.push({
      id: `doctor-${String(i + 1)}`,
      category: 'doctor',
      text: `عيادة الدكتور ${name}`,
    });
  });
  for (const name of NAMES) {
    clips.push({ id: nameClipId(name.id), category: 'name', text: name.diacritised });
  }
  for (const name of NAMES.filter((n) => n.alsoPlain)) {
    clips.push({ id: plainNameClipId(name.id), category: 'name-plain', text: name.plain });
  }
  const announcements = ANNOUNCEMENTS.map(([nameId, n, room], i) => ({
    id: `ann-${String(i + 1).padStart(2, '0')}`,
    clipIds: ['chime', nameClipId(nameId), numberClipId(n), roomClipId(room)],
  }));
  return withCharacters(kind, clips, announcements);
}
