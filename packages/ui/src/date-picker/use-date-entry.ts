// One value for the Date Picker's segments and calendar (slice 0.4-13 criteria 16 and 17):
// the ISO value (controlled or not) is owned here; the segments follow it unless they hold a
// date being typed that it already matches (a half-typed date reads null, so a null value leaves
// it as typed, as UI SDK's DateInput does). A complete typed date sets the value and the
// calendar's month; a day chosen in the calendar fills the segments. The error shows once focus
// leaves the segments, or at once for an impossible date; the line under the field confirms a
// complete date with its weekday (and the age, for birth dates).
import { useState } from 'react';
import type { Direction } from '../providers/direction-provider.tsx';
import { dateError, isImpossible } from './date-errors.ts';
import { type Entry, entryFromIso, toIso } from './date-fields.ts';
import { ageText, dateLine, todayIso } from './date-text.ts';

export interface DateEntryOptions {
  dir: Direction;
  value: string | null | undefined;
  defaultValue: string | null | undefined;
  onValueChange: ((value: string | null) => void) | undefined;
  min: string | undefined;
  max: string | undefined;
  maxMessage: string | undefined;
  showAge: boolean;
}

const monthOf = (iso: string | null): string => (iso ?? todayIso()).slice(0, 7);

export function useDateEntry({
  dir,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  maxMessage,
  showAge,
}: DateEntryOptions) {
  const [inner, setInner] = useState<string | null>(defaultValue ?? null);
  const current = value === undefined ? inner : value;
  const [entry, setEntryState] = useState<Entry>(() => entryFromIso(current));
  const [month, setMonth] = useState(() => monthOf(current));
  const [left, setLeft] = useState(false);

  // A value set from outside (a controlled prop, a form reset) fills the segments, unless they
  // already say the same, or hold a half-typed date while the value is null.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    if (current !== toIso(entry.fields)) setEntryState(entryFromIso(current));
  }

  const commit = (next: string | null) => {
    if (next === current) return;
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  /** The segments changed: a complete date becomes the value and the calendar's month. */
  const setEntry = (next: Entry) => {
    setEntryState(next);
    const iso = toIso(next.fields);
    commit(iso);
    if (iso !== null) setMonth(iso.slice(0, 7));
  };

  /** A day was chosen in the calendar: it fills the segments. */
  const choose = (iso: string | null) => {
    setEntryState(entryFromIso(iso));
    setLeft(false);
    commit(iso);
  };

  const iso = toIso(entry.fields);
  const problem = dateError({ fields: entry.fields, dir, min, max, maxMessage });
  const error = left || isImpossible(entry.fields) ? problem : null;
  let line: string | null = null;
  if (iso !== null && problem === null) {
    const age = showAge ? ageText(iso, todayIso(), dir) : null;
    line = age === null ? dateLine(iso, dir) : `${dateLine(iso, dir)} · ${age}`;
  }

  return {
    value: current,
    entry,
    setEntry,
    choose,
    month,
    setMonth,
    /** The calendar opens on the value's month, or today's. */
    openMonth: () => {
      setMonth(monthOf(current));
    },
    error,
    line,
    onLeave: () => {
      setLeft(true);
    },
    onEnter: () => {
      setLeft(false);
    },
  };
}
