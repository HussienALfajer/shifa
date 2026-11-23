// Time Input's slot grid (slice 0.4-13 criterion 19, OD-70 B, OD-73), as the owner approved the
// sheet on 2026-11-23 ("Shifa Components (proposals)", page "Before Phase A · 0.4-12 and
// 0.4-13", board "Time Input · time chooser", option B): the clock at the field's end is a button
// «اختيار الوقت» that opens a popup under the field; the clinic's slots in four columns, under a
// label per part of the day; a footer with the step and the hours, and «أقرب وقت».
//
// Behaviour: UI SDK's Popover (Escape and a press outside close it, focus returns to the button).
// Each group is a grid of buttons; all slots share one tab stop. Focus opens on the chosen time,
// or the next one after now. Arrows follow the reading direction, Up and Down move a row (into
// the next group at the same column), Home and End go to the group's ends; Enter or a press
// chooses and closes. Each time is written left to right (`dir="ltr"`) and read with its part of
// the day («10:30 صباحاً»); the chosen one is selected.
import { Field } from '@ui-sdk/react/field';
import {
  Popover as BasePopover,
  PopoverContent as BasePopoverContent,
  PopoverTrigger as BasePopoverTrigger,
} from '@ui-sdk/react/popover';
import { type KeyboardEvent, useRef, useState } from 'react';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';
import type { Direction } from '../providers/direction-provider.tsx';
import { DEFAULT_STEP, nextSlot, type Slot, timeSlots } from './slots.ts';

const LABELS = {
  rtl: {
    button: 'اختيار الوقت',
    nearest: 'أقرب وقت',
    every: (step: number) => `كل ${String(step)} دقيقة`,
  },
  ltr: {
    button: 'Choose a time',
    nearest: 'Nearest time',
    every: (step: number) => `Every ${String(step)} minutes`,
  },
} as const;
const COLUMNS = 4;

const TRIGGER = cn(
  'inline-flex size-(--shifa-size-control-sm) shrink-0 cursor-pointer items-center justify-center rounded-control border-0',
  'bg-transparent text-icon-default hover:bg-selection-subtle data-open:bg-selection-default',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus',
  'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-text-disabled',
);

const SLOT = cn(
  'h-10 w-full cursor-pointer rounded-control border border-border-default bg-bg-surface p-0',
  'font-ui text-250 font-medium leading-heading tabular-nums text-text-default hover:bg-selection-subtle',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
  'aria-pressed:border-brand-primary aria-pressed:bg-brand-primary aria-pressed:font-semibold aria-pressed:text-brand-on-primary',
);

export interface TimeSlotGridProps {
  dir: Direction;
  /** The field's box: the popup opens under it. */
  anchor: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chosen time ("HH:mm"), if any. */
  value: string | null;
  min?: string | undefined;
  max?: string | undefined;
  step?: number | undefined;
  hourCycle: 12 | 24;
  disabled?: boolean | undefined;
  /** A slot was chosen: fill the segments. */
  onChoose: (value: string) => void;
}

export function TimeSlotGrid({
  dir,
  anchor,
  open,
  onOpenChange,
  value,
  min,
  max,
  step,
  hourCycle,
  disabled,
  onChoose,
}: TimeSlotGridProps) {
  const labels = LABELS[dir];
  const groups = timeSlots({ min, max, step, hourCycle, dir });
  const slots = groups.flatMap((group) => group.slots);
  const now = new Date();
  const next = nextSlot(groups, now.getHours() * 60 + now.getMinutes());
  const chosen = slots.find((slot) => slot.value === value);
  const start = chosen ?? next;
  const [active, setActive] = useState<string | undefined>(start?.value);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // Each opening starts again on the chosen or next time.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setActive(start?.value);
  }
  const tabStop = slots.some((slot) => slot.value === active) ? active : start?.value;

  const choose = (slot: Slot | undefined) => {
    if (slot === undefined) return;
    onChoose(slot.value);
    onOpenChange(false);
  };

  const focusSlot = (slot: Slot | undefined) => {
    if (slot === undefined) return;
    setActive(slot.value);
    buttons.current.get(slot.value)?.focus();
  };

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, slot: Slot) {
    const groupIndex = groups.findIndex((group) => group.slots.includes(slot));
    const group = groups[groupIndex];
    if (group === undefined) return;
    const index = group.slots.indexOf(slot);
    const flat = slots.indexOf(slot);
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: Slot | undefined;
    if (event.key === forward) target = slots[flat + 1];
    else if (event.key === backward) target = slots[flat - 1];
    else if (event.key === 'Home') target = group.slots[0];
    else if (event.key === 'End') target = group.slots.at(-1);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const down = event.key === 'ArrowDown';
      const column = index % COLUMNS;
      target = group.slots[index + (down ? COLUMNS : -COLUMNS)];
      // Past the group's edge: the next (or previous) group, at the same column.
      if (target === undefined) {
        const other = groups[groupIndex + (down ? 1 : -1)];
        if (other !== undefined) {
          const lastRow = Math.floor((other.slots.length - 1) / COLUMNS) * COLUMNS;
          const at = down ? column : lastRow + column;
          target = other.slots[Math.min(at, other.slots.length - 1)];
        }
      }
    } else return;
    event.preventDefault();
    focusSlot(target ?? slot);
  }

  const hours =
    min === undefined && max === undefined ? '' : ` · ${min ?? '00:00'}–${max ?? '24:00'}`;

  return (
    // A Field of its own: UI SDK's popover trigger would otherwise join the time's Field.
    <Field className="contents">
      <BasePopover
        open={open}
        onOpenChange={(next: boolean) => {
          onOpenChange(next);
        }}
      >
        <BasePopoverTrigger
          aria-label={labels.button}
          {...(disabled === true ? { disabled: true } : {})}
          className={TRIGGER}
        >
          <Icon name="clock" />
        </BasePopoverTrigger>
        <BasePopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          {...(anchor === null ? {} : { anchor })}
          aria-label={labels.button}
          initialFocus="[data-autofocus]"
          className={cn(
            FLOATING_BOX,
            'flex w-(--shifa-size-popover) max-w-full flex-col gap-2 p-3',
          )}
        >
          <div className="flex max-h-(--shifa-size-slot-list-height) flex-col gap-2 overflow-y-auto p-1">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1">
                <span
                  aria-hidden="true"
                  className="px-0.5 py-1 text-200 font-semibold leading-heading text-text-muted"
                >
                  {group.name}
                </span>
                <div role="grid" aria-label={group.name} className="flex flex-col gap-2">
                  {Array.from({ length: Math.ceil(group.slots.length / COLUMNS) }, (_, row) => (
                    // biome-ignore lint/a11y/useFocusableInteractive: a grid row holds the focusable cells
                    <div key={row} role="row" className="grid grid-cols-4 gap-2">
                      {group.slots.slice(row * COLUMNS, row * COLUMNS + COLUMNS).map((slot) => (
                        <div key={slot.value} role="gridcell" aria-selected={slot.value === value}>
                          <button
                            ref={(el) => {
                              if (el === null) buttons.current.delete(slot.value);
                              else buttons.current.set(slot.value, el);
                            }}
                            type="button"
                            // A time is written left to right in both directions.
                            dir="ltr"
                            aria-label={slot.name}
                            aria-pressed={slot.value === value}
                            tabIndex={slot.value === tabStop ? 0 : -1}
                            {...(slot.value === start?.value ? { 'data-autofocus': '' } : {})}
                            onFocus={() => {
                              setActive(slot.value);
                            }}
                            onKeyDown={(event) => {
                              onKeyDown(event, slot);
                            }}
                            onClick={() => {
                              choose(slot);
                            }}
                            className={SLOT}
                          >
                            {slot.label}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border-default pt-2">
            <span className="text-200 leading-heading text-text-muted">
              {labels.every(step ?? DEFAULT_STEP)}
              <bdi dir="ltr">{hours}</bdi>
            </span>
            <button
              type="button"
              onClick={() => {
                choose(next);
              }}
              className={cn(
                'h-(--shifa-size-control-sm) shrink-0 cursor-pointer rounded-control border-0 bg-transparent px-3',
                'font-ui text-200 font-medium leading-heading text-brand-primary hover:bg-selection-subtle',
                'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus',
              )}
            >
              {labels.nearest}
            </button>
          </div>
        </BasePopoverContent>
      </BasePopover>
    </Field>
  );
}
