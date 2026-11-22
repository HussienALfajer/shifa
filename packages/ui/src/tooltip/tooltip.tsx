// Tooltip (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Overlays and navigation · 0.4-06") with OD-63: a dark ink bubble (the text
// and surface colours swapped, so it inverts in dark), above its trigger and centred, below when
// asked or when there is no room; at most 240 px wide, then the text wraps. It explains and never
// carries the only copy of something a person needs. Behaviour from UI SDK's Tooltip: keyboard
// focus opens it at once, hover after 500 ms, a touch tap never; Escape closes it and focus stays.
import {
  Tooltip as BaseTooltip,
  TooltipContent as BaseTooltipContent,
  TooltipTrigger as BaseTooltipTrigger,
} from '@ui-sdk/react/tooltip';
import type { ReactElement } from 'react';
import { cn } from '../lib/cn.ts';

/** Hover delay before a tooltip opens (OD-63). Focus opens it at once. */
const HOVER_DELAY_MS = 500;

export interface TooltipProps {
  /** Plain text: a tooltip cannot be focused, so it holds no links or buttons. */
  content: string;
  /** Above (default) or below the trigger; it flips when there is no room. */
  side?: 'top' | 'bottom' | undefined;
  /**
   * `description` (default): the tooltip adds to the trigger's name (aria-describedby).
   * `label`: the tooltip says the trigger's name (an icon button whose label it repeats).
   */
  type?: 'description' | 'label' | undefined;
  /** Turns the tooltip off while the trigger keeps working. */
  disabled?: boolean | undefined;
  /** Shown from the start (a drawing or a first-use hint); hover, focus and Escape still apply. */
  defaultOpen?: boolean | undefined;
  /** The trigger: one focusable element that takes its props and ref (a Button, an IconButton). */
  children: ReactElement;
}

export function Tooltip({
  content,
  side = 'top',
  type = 'description',
  disabled,
  defaultOpen,
  children,
}: TooltipProps) {
  return (
    <BaseTooltip
      delay={HOVER_DELAY_MS}
      type={type}
      {...(disabled === undefined ? {} : { disabled })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
    >
      <BaseTooltipTrigger render={children} />
      <BaseTooltipContent
        side={side}
        align="center"
        sideOffset={8}
        collisionPadding={8}
        className={cn(
          'm-0 max-w-(--shifa-size-tooltip) rounded-input px-3 py-1 text-center',
          'bg-(--shifa-tooltip-bg) text-(--shifa-tooltip-fg) shadow-dropdown',
          'font-ui text-200 font-medium leading-heading',
          'transition-opacity duration-(--shifa-motion-duration-fast) ease-enter',
          'data-starting-style:opacity-0 data-ending-style:opacity-0',
          'motion-reduce:transition-none motion-reduce:duration-0',
        )}
      >
        {content}
      </BaseTooltipContent>
    </BaseTooltip>
  );
}
