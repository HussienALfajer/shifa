// Time Input's slots (slice 0.4-13 criterion 19, OD-70 B, OD-73): the times a clinic books, at
// `step` minutes from midnight (15 by default, until it becomes a clinic setting), from `min` up
// to, not including, `max` (a 09:00–17:00 day ends at 16:45, as the sheet draws it). Grouped by
// the part of the day: ليلاً 00–06, صباحاً 06–12, بعد الظهر 12–17, مساءً 17–24 (OD-73); empty
// groups are dropped. Labels "HH:mm", or "hh:mm ص/م" on the 12-hour clock (OD-62).
import type { Direction } from '../providers/direction-provider.tsx';

export type SlotGroupId = 'night' | 'morning' | 'afternoon' | 'evening';

export interface Slot {
  /** "HH:mm", 24 hours: the value Time Input reports. */
  value: string;
  /** Minutes after midnight. */
  minutes: number;
  /** What the slot shows: «14:30», or «02:30 م» on the 12-hour clock. */
  label: string;
  /** What a screen reader hears: the label and its part of the day, «10:30 صباحاً». */
  name: string;
}

export interface SlotGroup {
  id: SlotGroupId;
  name: string;
  slots: Slot[];
}

export const DEFAULT_STEP = 15;

const GROUPS: readonly { id: SlotGroupId; from: number; to: number }[] = [
  { id: 'night', from: 0, to: 6 * 60 },
  { id: 'morning', from: 6 * 60, to: 12 * 60 },
  { id: 'afternoon', from: 12 * 60, to: 17 * 60 },
  { id: 'evening', from: 17 * 60, to: 24 * 60 },
];

const NAMES: Record<Direction, Record<SlotGroupId, string>> = {
  rtl: { night: 'ليلاً', morning: 'صباحاً', afternoon: 'بعد الظهر', evening: 'مساءً' },
  ltr: { night: 'Night', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
};

/** ص / م in Arabic and AM / PM in English, as Time Input's own period segment (OD-62). */
const PERIODS: Record<Direction, readonly [string, string]> = {
  rtl: ['ص', 'م'],
  ltr: ['AM', 'PM'],
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Minutes after midnight of "HH:mm", or undefined. */
export function minutesOf(time: string | null | undefined): number | undefined {
  const match = typeof time === 'string' ? /^(\d{2}):(\d{2})/.exec(time) : null;
  if (match === null) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * A step must divide an hour: refused in development; 15 in production, so a wrong setting never
 * leaves a clinic with no times to pick.
 */
export function checkStep(step: number): number {
  if (Number.isInteger(step) && step > 0 && 60 % step === 0) return step;
  if (import.meta.env?.DEV === true) {
    throw new Error(`Time Input: step ${String(step)} must divide 60 minutes`);
  }
  return DEFAULT_STEP;
}

function labelOf(minutes: number, hourCycle: 12 | 24, dir: Direction): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hourCycle === 24) return `${pad(hour)}:${pad(minute)}`;
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${pad(shown)}:${pad(minute)} ${PERIODS[dir][hour < 12 ? 0 : 1]}`;
}

export interface SlotOptions {
  min?: string | undefined;
  max?: string | undefined;
  step?: number | undefined;
  hourCycle?: 12 | 24 | undefined;
  dir: Direction;
}

/** The slots between `min` and `max`, by part of the day, without empty groups. */
export function timeSlots({ min, max, step, hourCycle = 24, dir }: SlotOptions): SlotGroup[] {
  const size = checkStep(step ?? DEFAULT_STEP);
  const first = minutesOf(min) ?? 0;
  const end = minutesOf(max) ?? 24 * 60;
  const groups: SlotGroup[] = [];
  for (const group of GROUPS) {
    const slots: Slot[] = [];
    for (let minutes = group.from; minutes < group.to; minutes += size) {
      if (minutes < first || minutes >= end) continue;
      const label = labelOf(minutes, hourCycle, dir);
      const part = NAMES[dir][group.id];
      slots.push({
        value: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
        minutes,
        label,
        name: dir === 'rtl' ? `${label} ${part}` : `${label}, ${part.toLowerCase()}`,
      });
    }
    if (slots.length > 0) groups.push({ id: group.id, name: NAMES[dir][group.id], slots });
  }
  return groups;
}

/** The first slot at or after `now` (minutes after midnight); the first slot when none is. */
export function nextSlot(groups: readonly SlotGroup[], now: number): Slot | undefined {
  const slots = groups.flatMap((group) => group.slots);
  return slots.find((slot) => slot.minutes >= now) ?? slots[0];
}
