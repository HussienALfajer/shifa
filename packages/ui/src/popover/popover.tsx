// Popover (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): a white box one level above the page (a light
// border, the dropdown shadow, radius 12) under its trigger, starting at the trigger's logical
// edge (the right in Arabic). Behaviour from UI SDK's Popover: focus moves to the first field,
// Escape or a press outside closes it and focus returns to the trigger; it flips above when
// there is no room below.
import {
  Popover as BasePopover,
  PopoverContent as BasePopoverContent,
  PopoverTitle,
  PopoverTrigger as BasePopoverTrigger,
} from '@ui-sdk/react/popover';
import type { ReactNode } from 'react';
import { type ButtonVariant, buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

/** The box of every floating panel (popover, menu, select and combobox lists, calendar). */
export const FLOATING_BOX = cn(
  'm-0 box-border overflow-auto rounded-surface border border-border-default bg-bg-surface p-2',
  'font-ui text-body leading-heading text-text-default shadow-dropdown',
  // A fade only: no rise, so the panel is in its place from the first frame (geometry, tests).
  'transition-opacity duration-(--shifa-motion-duration-base) ease-enter',
  'data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none',
);

export interface PopoverProps {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: ReactNode;
}

export function Popover({ open, defaultOpen, onOpenChange, children }: PopoverProps) {
  return (
    <BasePopover
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined
        ? {}
        : {
            onOpenChange: (next: boolean) => {
              onOpenChange(next);
            },
          })}
    >
      {children}
    </BasePopover>
  );
}

export interface PopoverTriggerProps {
  variant?: ButtonVariant | undefined;
  startIcon?: IconName | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A Button that opens the popover; it looks pressed while the popover is open. */
export function PopoverTrigger({
  variant,
  startIcon,
  disabled,
  className,
  children,
}: PopoverTriggerProps) {
  return (
    <BasePopoverTrigger
      {...(disabled === undefined ? {} : { disabled })}
      className={cn(buttonClasses({ variant: variant ?? 'secondary' }), className)}
    >
      {startIcon !== undefined && <Icon name={startIcon} />}
      <span className="min-w-0">{children}</span>
    </BasePopoverTrigger>
  );
}

export interface PopoverContentProps {
  /** The heading; it names the popover for screen readers. */
  title: ReactNode;
  className?: string | undefined;
  children?: ReactNode;
}

export function PopoverContent({ title, className, children }: PopoverContentProps) {
  return (
    <BasePopoverContent
      side="bottom"
      align="start"
      sideOffset={8}
      collisionPadding={8}
      className={cn(
        FLOATING_BOX,
        'flex w-(--shifa-size-popover) max-w-full flex-col gap-3 p-4',
        className,
      )}
    >
      <PopoverTitle className="m-0 text-body font-medium leading-heading">{title}</PopoverTitle>
      {children}
    </BasePopoverContent>
  );
}
