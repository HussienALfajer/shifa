// The Date Picker's typed date (slice 0.4-13 criterion 15, OD-69 A, OD-72), as the owner approved
// the sheet on 2026-11-23 ("Shifa Components (proposals)", page "Before Phase A · 0.4-12 and
// 0.4-13", board "Date Picker · typed entry", option A): three segments day / month / year, left
// to right in both directions (a date is written as a number), each a spinbutton named by its
// unit with a placeholder, slashes between them.
//
// Built on our own model (`date-fields.ts`), not UI SDK's `DateInput`, which moves 31/02 to 28/02
// without a word (OD-72); the keys follow the UI SDK gate (`date-input.gate.test.tsx`): digits
// fill and move on, a digit that cannot start a longer number moves on at once, `/ - .` and space
// move on, Backspace in an empty segment goes back, Up/Down step and wrap, Page Up/Down step
// more, Home/End go to the ends, Left/Right move to the segment on that side. Arabic-Indic digits
// are taken as Western ones (OD-20); a pasted date fills all three (`parse-date.ts`). The group is
// wired to its Field by UI SDK's `useFieldControl` (label, hint, error, aria-invalid).
import { useFieldControl } from '@ui-sdk/react/field';
import {
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { cn } from '../lib/cn.ts';
import { westernNumberText } from '../lib/use-western-digits.ts';
import type { Direction } from '../providers/direction-provider.tsx';
import {
  BOUNDS,
  DATE_UNITS,
  type DateUnit,
  type Entry,
  pageStep,
  removeDigit,
  segmentText,
  settle,
  stepEntry,
  stepToEnd,
  todayFields,
  typeDigit,
} from './date-fields.ts';
import { parseDateText } from './parse-date.ts';

const NAMES: Record<Direction, Record<DateUnit, string>> = {
  rtl: { day: 'اليوم', month: 'الشهر', year: 'السنة' },
  ltr: { day: 'Day', month: 'Month', year: 'Year' },
};
const PLACEHOLDERS: Record<Direction, Record<DateUnit, string>> = {
  rtl: { day: 'يوم', month: 'شهر', year: 'سنة' },
  ltr: { day: 'dd', month: 'mm', year: 'yyyy' },
};
const EMPTY_TEXT: Record<Direction, string> = { rtl: 'فارغ', ltr: 'Empty' };
const SEPARATOR = /[\s/.,\-–]/;

const SEGMENT = cn(
  // A segment is an input: as wide as its text, no box of its own (as Time Input).
  'field-sizing-content min-w-6 rounded-mark border-0 bg-transparent px-0.5 py-0 text-center',
  'font-ui text-body leading-heading in-data-[density=compact]:text-250 text-inherit tabular-nums outline-none',
  'placeholder:text-text-muted focus:bg-selection-strong disabled:text-text-disabled',
);

export interface DateSegmentsProps {
  dir: Direction;
  entry: Entry;
  onEntryChange: (entry: Entry) => void;
  /** «off», or «bday» inside a FormField that names it (OD-67): the segments take its parts. */
  autoComplete: string;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  /** Focus left the three segments. */
  onLeave: () => void;
  /** Focus came into them from outside. */
  onEnter: () => void;
  /** Alt+Down: open the calendar, as from UI SDK's own date field. */
  onOpenCalendar: () => void;
}

export function DateSegments({
  dir,
  entry,
  onEntryChange,
  autoComplete,
  disabled,
  required,
  onLeave,
  onEnter,
  onOpenCalendar,
}: DateSegmentsProps) {
  const field = useFieldControl();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // The latest entry, so several digits typed or pasted at once build on each other.
  const latest = useRef(entry);
  latest.current = entry;
  const groupRef = useRef<HTMLDivElement | null>(null);
  // The segment focus moved to because the one before it filled itself: a separator typed there
  // next is the person's habit, not a request to move on again (UI SDK's `advancedTo`).
  const advancedTo = useRef<number | null>(null);

  const change = useCallback(
    (next: Entry) => {
      latest.current = next;
      onEntryChange(next);
    },
    [onEntryChange],
  );
  const focusAt = (index: number) => inputs.current[index]?.focus();

  /** Types `text` from the segment at `start`, moving on as each fills (UI SDK's `insert`). */
  const insert = useCallback(
    (start: number, text: string) => {
      let index = start;
      for (const char of westernNumberText(text)) {
        const unit = DATE_UNITS[index];
        if (unit === undefined) break;
        const current = latest.current;
        if (/\d/.test(char)) {
          const typed = typeDigit(current, unit, char);
          change(typed.entry);
          advancedTo.current = null;
          if (typed.done && index < DATE_UNITS.length - 1) {
            index += 1;
            inputs.current[index]?.focus();
            advancedTo.current = index;
          }
        } else if (SEPARATOR.test(char)) {
          // Right after a segment filled itself, the separator the person types is skipped.
          const skip =
            advancedTo.current === index ||
            (current.buffer?.unit !== unit && current.fields[unit] === null);
          advancedTo.current = null;
          if (skip) continue;
          change(settle(current));
          if (index < DATE_UNITS.length - 1) {
            index += 1;
            inputs.current[index]?.focus();
          }
        }
      }
    },
    [change],
  );

  // Typing goes through `beforeinput`, cancelled, so the segment shows only what the model says.
  useEffect(() => {
    const cleanups = inputs.current.map((input, index) => {
      if (input === null) return undefined;
      const onBeforeInput = (event: InputEvent) => {
        if (!event.cancelable || event.isComposing) return;
        if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') return;
        event.preventDefault();
        const unit = DATE_UNITS[index];
        if (event.inputType.startsWith('insert') && event.data !== null) {
          insert(index, event.data);
        } else if (unit !== undefined && event.inputType === 'deleteByCut') {
          change({ fields: { ...latest.current.fields, [unit]: null }, buffer: null });
        } else if (unit !== undefined && event.inputType.startsWith('delete')) {
          // Deletions the keydown handler did not see (Ctrl+Backspace, a phone keyboard whose
          // keys arrive as «Unidentified»): as Backspace.
          const removed = removeDigit(latest.current, unit);
          if (removed.back) inputs.current[index - 1]?.focus();
          else change(removed.entry);
        }
      };
      input.addEventListener('beforeinput', onBeforeInput);
      return () => {
        input.removeEventListener('beforeinput', onBeforeInput);
      };
    });
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  }, [insert]);

  const groupProps = (field?.props({ role: 'group', 'data-slot': 'date-segments' }) ?? {
    role: 'group',
  }) as Record<string, unknown> & { id?: string; ref?: Ref<HTMLDivElement> };
  // The Field binds its control through this ref; without it, it wires the label to the first
  // input it finds (the day), whose name would then be the field's label.
  const fieldRef = groupProps.ref;
  const setGroup = useCallback(
    (el: HTMLDivElement | null) => {
      groupRef.current = el;
      if (typeof fieldRef === 'function') return fieldRef(el);
      if (fieldRef !== undefined && fieldRef !== null) fieldRef.current = el;
      return undefined;
    },
    [fieldRef],
  );

  // The Field's label points at the group, which is not a labelable element: a press on the
  // label focuses the first segment, as UI SDK's own segmented inputs do.
  const groupId = groupProps.id;
  useEffect(() => {
    if (groupId === undefined) return undefined;
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(groupId)}"]`);
    if (label === null) return undefined;
    const onClick = () => inputs.current[0]?.focus();
    label.addEventListener('click', onClick);
    return () => {
      label.removeEventListener('click', onClick);
    };
  }, [groupId]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number, unit: DateUnit) {
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      onOpenCalendar();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    const current = latest.current;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        // The segments run left to right in both directions: the key moves to that side.
        event.preventDefault();
        focusAt(index + (event.key === 'ArrowRight' ? 1 : -1));
        return;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown': {
        event.preventDefault();
        const size = event.key.startsWith('Page') ? pageStep(unit) : 1;
        const sign = event.key === 'ArrowUp' || event.key === 'PageUp' ? 1 : -1;
        change(stepEntry(current, unit, sign * size, todayFields()));
        return;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        change(stepToEnd(current, unit, event.key === 'Home' ? 'min' : 'max'));
        return;
      case 'Backspace': {
        event.preventDefault();
        const removed = removeDigit(current, unit);
        if (removed.back) focusAt(index - 1);
        else change(removed.entry);
        return;
      }
      case 'Delete':
        event.preventDefault();
        change({ fields: { ...current.fields, [unit]: null }, buffer: null });
        return;
      case 'Enter':
        change(settle(current));
        return;
      default:
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const parts = parseDateText(event.clipboardData.getData('text/plain'));
    if (parts !== null) change({ fields: parts, buffer: null });
  }

  // A keyboard whose insertions cannot be cancelled (some phone keyboards): the new characters
  // are taken from the input's text.
  function onChange(event: React.ChangeEvent<HTMLInputElement>, index: number, unit: DateUnit) {
    const shown = segmentText(latest.current, unit);
    const text = westernNumberText(event.target.value);
    if (text === '') change({ fields: { ...latest.current.fields, [unit]: null }, buffer: null });
    else insert(index, text.startsWith(shown) ? text.slice(shown.length) : text.slice(-1));
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (groupRef.current?.contains(event.relatedTarget) === true) return;
    change(settle(latest.current));
    onLeave();
  }

  function onFocus(event: FocusEvent<HTMLDivElement>) {
    if (groupRef.current?.contains(event.relatedTarget) === true) return;
    onEnter();
  }

  return (
    <div
      {...groupProps}
      ref={setGroup}
      role="group"
      dir="ltr"
      onFocus={onFocus}
      onBlur={onBlur}
      // Left to right inside; in Arabic the date sits at the line's start, the right.
      className={cn(
        'flex min-w-0 flex-1 items-center',
        dir === 'rtl' ? 'justify-end' : 'justify-start',
      )}
    >
      {DATE_UNITS.map((unit, index) => {
        const text = segmentText(entry, unit);
        const value = entry.fields[unit];
        const [min, max] = BOUNDS[unit];
        return [
          index > 0 && (
            <span key={`sep-${unit}`} aria-hidden="true" className="text-text-muted">
              /
            </span>
          ),
          <input
            key={unit}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            type="text"
            role="spinbutton"
            inputMode="numeric"
            aria-label={NAMES[dir][unit]}
            {...(required === true ? { 'aria-required': true } : {})}
            aria-valuemin={min}
            aria-valuemax={max}
            {...(value === null ? {} : { 'aria-valuenow': value })}
            aria-valuetext={text === '' ? EMPTY_TEXT[dir] : text}
            placeholder={PLACEHOLDERS[dir][unit]}
            size={unit === 'year' ? 4 : 2}
            autoComplete={autoComplete === 'bday' ? `bday-${unit}` : 'off'}
            autoCorrect="off"
            spellCheck={false}
            data-unit={unit}
            {...(text === '' ? { 'data-empty': '' } : {})}
            disabled={disabled === true}
            value={text}
            onChange={(event) => {
              onChange(event, index, unit);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index, unit);
            }}
            onPaste={onPaste}
            onFocus={(event) => {
              advancedTo.current = null;
              const input = event.currentTarget;
              requestAnimationFrame(() => {
                if (document.activeElement === input) input.select();
              });
            }}
            className={SEGMENT}
          />,
        ];
      })}
    </div>
  );
}
