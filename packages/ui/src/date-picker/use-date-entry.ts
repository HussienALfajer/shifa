// One value for the Date Picker's segments and calendar (slice 0.4-13 criteria 16 and 17):
// the ISO value (controlled or not) is owned here; the segments follow it unless they hold a
// date being typed that it already matches (a half-typed date reads null, so a null value leaves
// it as typed, as UI SDK's DateInput does). A complete typed date sets the value and the
// calendar's month; a day chosen in the calendar fills the segments. The error shows once focus
// leaves the segments, or at once for an impossible date; the line under the field confirms a
// complete date with its weekday (and the age, for birth dates).
import { useEffect, useRef, useState } from 'react';
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
  // Once controlled (a form field), an undefined value means empty, not the last typed date (a
  // form reset to no default; the OTP field's fix in 0.4-12).
  const [controlled, setControlled] = useState(value !== undefined);
  if (value !== undefined && !controlled) setControlled(true);
  const current = value === undefined ? (controlled ? null : inner) : value;
  const [entry, setEntryState] = useState<Entry>(() => entryFromIso(current));
  const [month, setMonth] = useState(() => monthOf(current));
  const [left, setLeft] = useState(false);

  // What the field last reported: its own value coming back from a form is not a change from
  // outside, so a half-typed date (reported as null) stays as typed.
  const [echo, setEcho] = useState<string | null | undefined>(value);
  // A value set from outside (a controlled prop, a form reset) fills the segments, unless they
  // already hold that same date.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    const same = current !== null && current === toIso(entry.fields);
    if (value !== echo && !same) setEntryState(entryFromIso(current));
  }

  // The value last sent, read by handlers: several changes in one event build on each other.
  const sent = useRef(current);
  useEffect(() => {
    sent.current = current;
  }, [current]);

  const commit = (next: string | null) => {
    if (next === sent.current) return;
    sent.current = next;
    setEcho(next);
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  /** Within min and max (ISO dates compare as text). */
  const inRange = (iso: string) =>
    (min === undefined || iso >= min) && (max === undefined || iso <= max);

  /** The segments changed: a complete date becomes the value and the calendar's month. */
  const setEntry = (next: Entry) => {
    setEntryState(next);
    const iso = toIso(next.fields);
    // A date outside min/max is shown with its error but is never the value (as UI SDK refused it).
    commit(iso !== null && inRange(iso) ? iso : null);
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
