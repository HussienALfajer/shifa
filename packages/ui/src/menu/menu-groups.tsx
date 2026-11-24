// Menu groups (slice A-01-08), as the owner approved the sheet `MenuGroupsSheet` on 2026-11-24
// ("Shifa Screens · Clinic web", page "A-01-08 Team batch"): an addition to the approved Menu,
// not a new component. A group with a label that names it; a radio group whose rows carry an
// avatar or an icon, a second line, a badge, the check at the logical end and a busy state
// (a spinner in place of the check, `aria-busy`); a note row for information only (a dashed
// outline, never chosen). Choosing a radio row keeps the menu open: the caller closes it once the
// choice took effect (a switch of clinic waits for the server). The clinic and branch switcher
// uses it.
import {
  MenuGroup as BaseMenuGroup,
  MenuGroupLabel as BaseMenuGroupLabel,
  MenuItem as BaseMenuItem,
  MenuRadioGroup as BaseMenuRadioGroup,
  MenuRadioItem as BaseMenuRadioItem,
  MenuItemIndicator,
} from '@ui-sdk/react/menu';
import type { ReactNode } from 'react';
import { Avatar } from '../avatar/avatar.tsx';
import { Badge } from '../badge/badge.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { Spinner } from '../spinner/spinner.tsx';
import { GROUP_LABEL, ITEM } from './menu-styles.ts';

export interface MenuGroupProps {
  /** Shown above the rows; it names the group for screen readers. */
  label: string;
  children: ReactNode;
}

/** Rows under a label: plain items or note rows. */
export function MenuGroup({ label, children }: MenuGroupProps) {
  return (
    <BaseMenuGroup className="flex flex-col gap-0.5">
      <BaseMenuGroupLabel className={GROUP_LABEL}>{label}</BaseMenuGroupLabel>
      {children}
    </BaseMenuGroup>
  );
}

export interface MenuRadioGroupProps {
  /** Shown above the rows; it names the group for screen readers. */
  label: string;
  /** The checked row's value; null checks none. */
  value: string | null;
  /** Runs with the chosen row's value; the menu stays open. */
  onValueChange: (value: string) => void;
  children: ReactNode;
}

/** One choice among its rows: the current one checked. */
export function MenuRadioGroup({ label, value, onValueChange, children }: MenuRadioGroupProps) {
  return (
    <BaseMenuGroup className="flex flex-col gap-0.5">
      <BaseMenuGroupLabel className={GROUP_LABEL}>{label}</BaseMenuGroupLabel>
      <BaseMenuRadioGroup
        value={value}
        onValueChange={(next: string) => {
          onValueChange(next);
        }}
        className="flex flex-col gap-0.5"
      >
        {children}
      </BaseMenuRadioGroup>
    </BaseMenuGroup>
  );
}

export interface MenuRadioItemProps {
  value: string;
  /** A name for an avatar on the logical start (a clinic, a person). */
  avatar?: string | undefined;
  /** An icon on the logical start, when there is no avatar (a branch). */
  icon?: IconName | undefined;
  /** The second line: role, scope, last activity, or why the row is disabled. */
  description?: ReactNode | undefined;
  /** A short warning word beside the name («موقوفة»); never colour alone. */
  badge?: string | undefined;
  /** Reachable and announced as disabled, but never chosen. Say why in `description`. */
  disabled?: boolean | undefined;
  /** The choice is being applied: a spinner in place of the check. */
  busy?: boolean | undefined;
  /** What screen readers hear while busy. */
  busyLabel?: string | undefined;
  /** The name of the check on the current row. */
  checkedLabel?: string | undefined;
  children: string;
}

export function MenuRadioItem({
  value,
  avatar,
  icon,
  description,
  badge,
  disabled,
  busy,
  busyLabel = 'جارٍ التنفيذ',
  checkedLabel = 'الحالية',
  children,
}: MenuRadioItemProps) {
  return (
    <BaseMenuRadioItem
      value={value}
      label={children}
      {...(disabled === undefined ? {} : { disabled })}
      aria-busy={busy === true ? 'true' : undefined}
      className={cn(
        ITEM,
        'gap-3 py-2 data-checked:font-semibold',
        'in-data-[density=compact]:min-h-(--shifa-size-control-sm) in-data-[density=compact]:py-1',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{children}</span>
        {description !== undefined && (
          <span className="text-200 leading-body font-normal text-text-muted tabular-nums in-data-disabled:text-text-disabled">
            {description}
          </span>
        )}
      </span>
      {/* After the name in the DOM, so the row's text starts with the name; drawn first. */}
      {avatar !== undefined && (
        // The row's text names it: the avatar's own name would be read twice.
        <span aria-hidden="true" className="order-first inline-flex shrink-0">
          <Avatar name={avatar} size="sm" />
        </span>
      )}
      {avatar === undefined && icon !== undefined && (
        <Icon
          name={icon}
          className="order-first text-icon-muted in-data-disabled:text-text-disabled"
        />
      )}
      {badge !== undefined && <Badge tone="warning">{badge}</Badge>}
      {busy === true ? (
        <Spinner size="sm" delay={0} label={busyLabel} />
      ) : (
        <MenuItemIndicator className="inline-flex shrink-0 text-brand-primary">
          <Icon name="check" label={checkedLabel} />
        </MenuItemIndicator>
      )}
    </BaseMenuRadioItem>
  );
}

export interface MenuNoteProps {
  icon?: IconName | undefined;
  /** The second line. */
  description?: ReactNode | undefined;
  children: ReactNode;
}

/**
 * Information inside a menu, not a choice (an invitation answered on its own link). A menu may
 * hold only items, so it is a disabled item (owner, 2026-11-24): reachable by the arrows and read
 * aloud, never run; drawn in the text colour with a dashed outline, not as a disabled action.
 */
export function MenuNote({ icon, description, children }: MenuNoteProps) {
  return (
    <BaseMenuItem
      disabled
      data-menu-note=""
      className={cn(
        'mt-1 flex min-h-(--shifa-size-row) cursor-default items-center gap-3 rounded-input px-3 py-2 outline-none',
        'border border-dashed border-border-strong text-body leading-heading text-text-default',
        'data-highlighted:bg-selection-subtle',
      )}
    >
      {icon !== undefined && <Icon name={icon} className="text-icon-muted" />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{children}</span>
        {description !== undefined && (
          <span className="text-200 leading-body text-text-muted">{description}</span>
        )}
      </span>
    </BaseMenuItem>
  );
}
