// Segmented control (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa
// Components (proposals)", page "Overlays and navigation · 0.4-06"): one choice of two to five
// that switches a view at once (day, week, month). A 44 px track (32 compact) in the raised
// surface colour; the chosen option is a white raised segment with heavier text, so it is not told
// by colour alone. Behaviour from UI SDK's SegmentedControl, a radio group: one Tab stop on the
// chosen option, the arrows move and choose together and follow the reading direction, a disabled
// option skipped. UI SDK's radio group has no Home and End; the sheet promised them, so this
// wrapper adds them (choose the first or last enabled option). For a value sent with a form, use
// RadioGroup.
import {
  SegmentedControl as BaseSegmentedControl,
  SegmentedControlItem as BaseSegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import type { KeyboardEvent } from 'react';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

/** Home and End choose the first or the last enabled option. */
function onHomeEnd(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Home' && event.key !== 'End') return;
  const options = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([data-disabled])'),
  ];
  const target = event.key === 'Home' ? options[0] : options.at(-1);
  if (target === undefined) return;
  event.preventDefault();
  target.focus();
  target.click();
}

export interface SegmentedControlItem {
  value: string;
  label: string;
  /** An icon before the label, on the logical start. */
  icon?: IconName | undefined;
  /** A count after the label («5» waiting). */
  count?: number | undefined;
  disabled?: boolean | undefined;
}

export interface SegmentedControlProps {
  /** What the choice is about, for screen readers («عرض التقويم»). */
  'aria-label': string;
  /** Two to five options. */
  items: readonly SegmentedControlItem[];
  /** The chosen option, when the parent owns it. */
  value?: string | undefined;
  /** The option chosen at first. */
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

const ITEM = cn(
  'inline-flex min-w-(--shifa-size-target-min) items-center justify-center gap-2 self-stretch px-4',
  'rounded-input border border-transparent bg-transparent',
  'font-ui text-body font-medium leading-heading whitespace-nowrap text-text-muted in-data-[density=compact]:px-3 in-data-[density=compact]:text-200',
  'cursor-pointer select-none transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  'hover:bg-selection-subtle hover:text-text-default',
  'data-checked:border-border-default data-checked:bg-bg-surface data-checked:font-semibold data-checked:text-text-default data-checked:shadow-card',
  'data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:text-text-disabled',
  'data-checked:data-disabled:bg-bg-surface data-checked:data-disabled:shadow-none',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus focus-visible:transition-none',
);

export function SegmentedControl({
  items,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  ...aria
}: SegmentedControlProps) {
  return (
    <BaseSegmentedControl
      {...aria}
      onKeyDown={onHomeEnd}
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(onValueChange === undefined
        ? {}
        : {
            onValueChange: (next: string | null) => {
              if (next !== null) onValueChange(next);
            },
          })}
      className={cn(
        'inline-flex h-(--shifa-size-control-md) max-w-full gap-0.5 overflow-x-auto p-0.5',
        'rounded-control border border-border-default bg-bg-surface-raised',
        className,
      )}
    >
      {items.map((item) => (
        <BaseSegmentedControlItem
          key={item.value}
          value={item.value}
          {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
          className={ITEM}
        >
          {item.icon !== undefined && <Icon name={item.icon} />}
          <span>{item.label}</span>
          {item.count !== undefined && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-pill bg-status-neutral-bg px-2 text-caption font-semibold leading-heading text-status-neutral-fg tabular-nums">
              {item.count}
            </span>
          )}
        </BaseSegmentedControlItem>
      ))}
    </BaseSegmentedControl>
  );
}
