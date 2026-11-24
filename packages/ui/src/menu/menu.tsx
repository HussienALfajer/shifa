// Menu (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): 48 px rows (32 compact), an icon on the logical
// start, the item under the keyboard or pointer in the light selection tint, a submenu chevron
// pointing to the logical end, the danger item in brick, last, after a separator. Behaviour from
// UI SDK's Menu: Up and Down, Home and End, typeahead (Arabic letters included), the forward
// arrow of the reading direction opens a submenu and the backward one closes it, Enter runs the
// action and focus returns to the trigger. A disabled item is reachable, says why, never runs.
// Slice A-01-08 (sheet `MenuGroupsSheet`, approved 2026-11-24) added groups and radio rows
// (`menu-groups.tsx`), an item that keeps the menu open (`closeOnSelect={false}`, a step inside
// the menu), a trigger with a size and a name of its own, and `presentation="sheet"` for a phone:
// the same rows rising from the bottom under a grabber, the content's `title` and a close button.
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
import { createContext, type ReactNode, useContext, useId, useState } from 'react';
import { type ButtonVariant, buttonClasses } from '../button/button.tsx';
import { IconButton } from '../icon-button/icon-button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';
import { ITEM } from './menu-styles.ts';

export {
  MenuGroup,
  type MenuGroupProps,
  MenuNote,
  type MenuNoteProps,
  MenuRadioGroup,
  type MenuRadioGroupProps,
  MenuRadioItem,
  type MenuRadioItemProps,
} from './menu-groups.tsx';

export type MenuPresentation = 'popover' | 'sheet';

const SheetContext = createContext<{ sheet: boolean; close: () => void }>({
  sheet: false,
  close: () => undefined,
});

export interface MenuProps {
  /** Runs with the item's `value` when an item is chosen. */
  onAction?: ((value: string) => void) | undefined;
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** `sheet` on a phone: the same rows rising from the bottom, with MenuContent's `title`. */
  presentation?: MenuPresentation | undefined;
  children: ReactNode;
}

export function Menu({
  onAction,
  open,
  defaultOpen,
  onOpenChange,
  presentation = 'popover',
  children,
}: MenuProps) {
  // Held here even when uncontrolled, so the sheet's close button can close it.
  const [inner, setInner] = useState(defaultOpen ?? false);
  const change = (next: boolean) => {
    setInner(next);
    onOpenChange?.(next);
  };
  return (
    <SheetContext
      value={{
        sheet: presentation === 'sheet',
        close: () => {
          change(false);
        },
      }}
    >
      <BaseMenu
        presentation={presentation}
        open={open ?? inner}
        onOpenChange={(next: boolean) => {
          change(next);
        }}
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
    </SheetContext>
  );
}

interface MenuTriggerCommon {
  variant?: ButtonVariant | undefined;
  /** md (default) or sm, as Button. */
  size?: 'sm' | 'md' | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  'data-testid'?: string | undefined;
}

/**
 * A Button that opens the menu: with a label, or an icon only (then `aria-label` names it). A
 * label may carry a fuller `aria-label` («العيادة والفرع: …»).
 */
export type MenuTriggerProps = MenuTriggerCommon &
  (
    | { children: ReactNode; icon?: IconName | undefined; 'aria-label'?: string | undefined }
    | { children?: undefined; icon: IconName; 'aria-label': string }
  );

export function MenuTrigger(props: MenuTriggerProps) {
  const { variant, size, disabled, className, children, icon } = props;
  const iconOnly = children === undefined;
  const name = props['aria-label'];
  const testId = props['data-testid'];
  return (
    <BaseMenuTrigger
      {...(disabled === undefined ? {} : { disabled })}
      {...(name === undefined ? {} : { 'aria-label': name })}
      {...(testId === undefined ? {} : { 'data-testid': testId })}
      className={cn(
        buttonClasses({ variant: variant ?? 'secondary', size: size ?? 'md', iconOnly }),
        'min-w-0',
        className,
      )}
    >
      {icon !== undefined && <Icon name={icon} />}
      {!iconOnly && <span className="min-w-0 truncate">{children}</span>}
      {!iconOnly && <Icon name="caret-down" />}
    </BaseMenuTrigger>
  );
}

const CONTENT = cn(
  FLOATING_BOX,
  'flex w-max min-w-(--anchor-width) max-w-(--shifa-size-popover) flex-col gap-0.5',
);

// A sheet: the full width, rising from the bottom, at most 5/6 of the screen high, as Drawer's.
const SHEET = cn(
  'data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-none',
  'data-[presentation=sheet]:max-h-5/6 data-[presentation=sheet]:rounded-b-none',
  'data-[presentation=sheet]:rounded-t-overlay data-[presentation=sheet]:border-0',
  'data-[presentation=sheet]:px-4 data-[presentation=sheet]:pt-3 data-[presentation=sheet]:pb-6',
  'data-[presentation=sheet]:shadow-overlay',
);

export interface MenuContentProps {
  /** The sheet's heading on a phone («العيادة والفرع»); a popover shows none. */
  title?: string | undefined;
  /** The name of the sheet's close button. */
  closeLabel?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function MenuContent({
  title,
  closeLabel = 'إغلاق',
  className,
  children,
}: MenuContentProps) {
  const { sheet, close } = useContext(SheetContext);
  const titleId = useId();
  const named = sheet && title !== undefined;
  return (
    <BaseMenuContent
      side="bottom"
      align="start"
      sideOffset={8}
      collisionPadding={8}
      {...(named ? { 'aria-labelledby': titleId } : {})}
      className={cn(CONTENT, SHEET, className)}
    >
      {sheet && (
        // A menu holds only items (axe): the drawn title names the menu, and the header with its
        // close button is hidden from screen readers, who close with Escape (owner, 2026-11-24).
        <div aria-hidden="true" className="flex flex-col">
          <span className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
          <div className="flex items-center gap-2 px-1 pb-1">
            {named && (
              <span
                id={titleId}
                className="min-w-0 flex-1 text-heading-sm leading-heading font-semibold"
              >
                {title}
              </span>
            )}
            <IconButton
              icon="x"
              label={closeLabel}
              variant="ghost"
              size="sm"
              tabIndex={-1}
              className="ms-auto"
              onClick={close}
            />
          </div>
        </div>
      )}
      {children}
    </BaseMenuContent>
  );
}

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
  /** False keeps the menu open (a step inside the menu, such as «رجوع»). */
  closeOnSelect?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function MenuItem({
  value,
  icon,
  danger,
  disabled,
  hint,
  closeOnSelect,
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
      {...(closeOnSelect === undefined ? {} : { closeOnSelect })}
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
