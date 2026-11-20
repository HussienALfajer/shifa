// Menu (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): 48 px rows (32 compact), an icon on the logical
// start, the item under the keyboard or pointer in the light selection tint, a submenu chevron
// pointing to the logical end, the danger item in brick, last, after a separator. Behaviour from
// UI SDK's Menu: Up and Down, Home and End, typeahead (Arabic letters included), the forward
// arrow of the reading direction opens a submenu and the backward one closes it, Enter runs the
// action and focus returns to the trigger. A disabled item is reachable, says why, never runs.
import {
  Menu as BaseMenu,
  MenuContent as BaseMenuContent,
  MenuItem as BaseMenuItem,
  MenuSeparator as BaseMenuSeparator,
  MenuTrigger as BaseMenuTrigger,
  MenuItemIcon,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from '@ui-sdk/react/menu';
import type { ReactNode } from 'react';
import { type ButtonVariant, buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';

export interface MenuProps {
  /** Runs with the item's `value` when an item is chosen. */
  onAction?: ((value: string) => void) | undefined;
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: ReactNode;
}

export function Menu({ onAction, open, defaultOpen, onOpenChange, children }: MenuProps) {
  return (
    <BaseMenu
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined
        ? {}
        : {
            onOpenChange: (next: boolean) => {
              onOpenChange(next);
            },
          })}
      {...(onAction === undefined
        ? {}
        : {
            onAction: (value: unknown) => {
              onAction(String(value));
            },
          })}
    >
      {children}
    </BaseMenu>
  );
}

interface MenuTriggerCommon {
  variant?: ButtonVariant | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

/** A Button that opens the menu: with a label, or an icon only (then `aria-label` names it). */
export type MenuTriggerProps = MenuTriggerCommon &
  (
    | { children: ReactNode; icon?: IconName | undefined }
    | { children?: undefined; icon: IconName; 'aria-label': string }
  );

export function MenuTrigger(props: MenuTriggerProps) {
  const { variant, disabled, className, children, icon } = props;
  const iconOnly = children === undefined;
  return (
    <BaseMenuTrigger
      {...(disabled === undefined ? {} : { disabled })}
      {...('aria-label' in props ? { 'aria-label': props['aria-label'] } : {})}
      className={cn(buttonClasses({ variant: variant ?? 'secondary', iconOnly }), className)}
    >
      {icon !== undefined && <Icon name={icon} />}
      {!iconOnly && <span className="min-w-0">{children}</span>}
      {!iconOnly && <Icon name="caret-down" className="text-icon-muted" />}
    </BaseMenuTrigger>
  );
}

const CONTENT = cn(
  FLOATING_BOX,
  'flex w-max min-w-(--anchor-width) max-w-(--shifa-size-popover) flex-col gap-0.5',
);

export function MenuContent({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <BaseMenuContent
      side="bottom"
      align="start"
      sideOffset={8}
      collisionPadding={8}
      className={cn(CONTENT, className)}
    >
      {children}
    </BaseMenuContent>
  );
}

const ITEM = cn(
  'flex min-h-(--shifa-size-row) cursor-pointer select-none items-center gap-2 rounded-input px-3 outline-none',
  'text-body leading-heading text-text-default in-data-[density=compact]:text-250',
  'data-highlighted:bg-selection-subtle data-open:bg-selection-default',
  'data-destructive:text-status-danger-fg',
  'data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
);

/** The icon column: an icon, or an empty slot so labels line up. */
function ItemIcon({ icon }: { icon?: IconName | undefined }) {
  return (
    <MenuItemIcon className="inline-flex size-(--shifa-size-icon-sm) shrink-0 text-icon-muted in-data-destructive:text-status-danger-fg in-data-disabled:text-text-disabled">
      {icon !== undefined && <Icon name={icon} />}
    </MenuItemIcon>
  );
}

export interface MenuItemProps {
  /** What `onAction` receives. */
  value: string;
  icon?: IconName | undefined;
  /** Deletes or cancels: brick, never red; put it last, after a separator. */
  danger?: boolean | undefined;
  /** Reachable and announced as disabled, but never runs. Say why in `hint`. */
  disabled?: boolean | undefined;
  /** A short note at the end of the row, such as why the item is disabled. */
  hint?: ReactNode | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function MenuItem({
  value,
  icon,
  danger,
  disabled,
  hint,
  className,
  children,
}: MenuItemProps) {
  return (
    <BaseMenuItem
      value={value}
      // Typeahead matches the label only, not the hint after it.
      {...(typeof children === 'string' ? { label: children } : {})}
      {...(disabled === undefined ? {} : { disabled })}
      {...(danger === true ? { destructive: true } : {})}
      className={cn(ITEM, className)}
    >
      <ItemIcon icon={icon} />
      <span className="min-w-0 flex-1">{children}</span>
      {hint !== undefined && (
        <span className="ms-auto shrink-0 text-200 text-text-muted in-data-disabled:text-text-disabled">
          {hint}
        </span>
      )}
    </BaseMenuItem>
  );
}

export function MenuSeparator() {
  return <BaseMenuSeparator className="mx-2 my-1 h-0 border-t border-border-default" />;
}

export interface SubmenuProps {
  label: string;
  icon?: IconName | undefined;
  disabled?: boolean | undefined;
  children: ReactNode;
}

/** An item that opens a menu beside it, on the logical end (the left in Arabic). */
export function Submenu({ label, icon, disabled, children }: SubmenuProps) {
  return (
    <MenuSub>
      <MenuSubTrigger {...(disabled === undefined ? {} : { disabled })} className={ITEM}>
        <ItemIcon icon={icon} />
        <span className="min-w-0 flex-1">{label}</span>
        <Icon name="caret-forward" className="ms-auto text-icon-muted" />
      </MenuSubTrigger>
      <MenuSubContent
        side="end"
        align="start"
        sideOffset={4}
        // Its top edge meets the item's (the default would line its first item up instead).
        alignOffset={0}
        collisionPadding={8}
        className={CONTENT}
      >
        {children}
      </MenuSubContent>
    </MenuSub>
  );
}
