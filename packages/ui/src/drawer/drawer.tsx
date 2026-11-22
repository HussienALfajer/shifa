// Drawer (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Overlays and navigation · 0.4-06") with OD-63: a panel to edit a record
// without leaving the page. From the logical end by default (the left in Arabic), 400 px wide and
// the full height, radius 16 on its inner edge only, the overlay shadow; `side="start"` for a
// navigation list; `side="bottom"` on a tablet or phone, at most 5/6 of the screen high, with a
// named grabber. A header with the title and a close button at its end, a body that scrolls, and
// the actions at the end of the last line. Behaviour from UI SDK's Drawer: modal, focus on the
// first field (else the close button), Tab kept inside, Escape, the close button, a press outside
// and a drag toward its edge close it, focus returns to the trigger; it fades instead of sliding
// under reduced motion. No snap points in this slice.
import {
  Drawer as BaseDrawer,
  DrawerBackdrop as BaseDrawerBackdrop,
  DrawerClose as BaseDrawerClose,
  DrawerContent as BaseDrawerContent,
  DrawerHandle as BaseDrawerHandle,
  DrawerTrigger as BaseDrawerTrigger,
  DrawerDescription,
  DrawerTitle,
} from '@ui-sdk/react/drawer';
import { createContext, type ReactNode, useContext, useRef } from 'react';
import { type ButtonVariant, buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export type DrawerSide = 'start' | 'end' | 'bottom';

const SideContext = createContext<DrawerSide>('end');

export interface DrawerProps {
  /** Where it comes from: the logical end (default), the start, or the bottom (tablet, phone). */
  side?: DrawerSide | undefined;
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: ReactNode;
}

export function Drawer({ side = 'end', open, defaultOpen, onOpenChange, children }: DrawerProps) {
  return (
    <SideContext value={side}>
      <BaseDrawer
        side={side}
        // Side drawers: a swipe from the screen edge on iOS goes back a page; keep it for that.
        preventEdgeSwipe={side !== 'bottom'}
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
      </BaseDrawer>
    </SideContext>
  );
}

export interface DrawerTriggerProps {
  variant?: ButtonVariant | undefined;
  startIcon?: IconName | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A Button that opens the drawer. */
export function DrawerTrigger({
  variant,
  startIcon,
  disabled,
  className,
  children,
}: DrawerTriggerProps) {
  return (
    <BaseDrawerTrigger
      {...(disabled === undefined ? {} : { disabled })}
      className={cn(buttonClasses({ variant: variant ?? 'secondary' }), className)}
    >
      {startIcon !== undefined && <Icon name={startIcon} />}
      <span className="min-w-0">{children}</span>
    </BaseDrawerTrigger>
  );
}

/** Where focus lands when the drawer opens: a field a person can Tab to, else the close button. */
function initialFocus(content: HTMLElement | null): HTMLElement | null {
  if (content === null) return null;
  const field = [
    ...content.querySelectorAll<HTMLElement>('input, textarea, select, [role="combobox"]'),
  ].find(
    (el) =>
      el.tabIndex >= 0 &&
      !el.matches(':disabled, [type="hidden"]') &&
      el.closest('[aria-hidden="true"], [hidden], [inert]') === null,
  );
  return field ?? content.querySelector<HTMLElement>('[data-slot="drawer-close"]');
}

const PANEL: Record<DrawerSide, string> = {
  end: 'h-full w-(--shifa-size-drawer) max-w-full rounded-s-overlay',
  start: 'h-full w-(--shifa-size-drawer) max-w-full rounded-e-overlay',
  bottom: 'max-h-5/6 w-full rounded-t-overlay',
};

export interface DrawerContentProps {
  /** The heading; it names the drawer. */
  title: ReactNode;
  /** A sentence under the title; read with it. */
  description?: ReactNode | undefined;
  /** The name of the close button, for screen readers. */
  closeLabel?: string | undefined;
  /** The name of the bottom drawer's grabber. */
  handleLabel?: string | undefined;
  className?: string | undefined;
  /** The body; DrawerActions last. */
  children?: ReactNode;
}

export function DrawerContent({
  title,
  description,
  closeLabel = 'إغلاق',
  handleLabel = 'اسحب لتغيير الحجم أو للإغلاق',
  className,
  children,
}: DrawerContentProps) {
  const side = useContext(SideContext);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <BaseDrawerBackdrop className="fixed inset-0 bg-bg-overlay" />
      <BaseDrawerContent
        ref={ref}
        initialFocus={() => initialFocus(ref.current)}
        className={cn(
          'flex flex-col bg-bg-surface text-text-default shadow-overlay',
          'font-ui text-body leading-body',
          PANEL[side],
          className,
        )}
      >
        {side === 'bottom' && (
          <BaseDrawerHandle
            aria-label={handleLabel}
            className="mx-auto mt-1 flex h-6 w-16 shrink-0 cursor-grab items-center justify-center rounded-input border-0 bg-transparent focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus"
          >
            <span className="h-1 w-9 rounded-full bg-border-strong" />
          </BaseDrawerHandle>
        )}
        <div
          className={cn(
            'flex shrink-0 items-start gap-3 border-b border-border-default px-6 py-5',
            side === 'bottom' && 'pt-2',
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DrawerTitle className="m-0 text-heading-sm font-semibold leading-heading">
              {title}
            </DrawerTitle>
            {description !== undefined && (
              <DrawerDescription className="m-0 text-data leading-body text-text-muted">
                {description}
              </DrawerDescription>
            )}
          </div>
          <BaseDrawerClose
            aria-label={closeLabel}
            className={cn(
              buttonClasses({ variant: 'ghost', size: 'sm', iconOnly: true }),
              'text-text-muted',
            )}
          >
            <Icon name="x" />
          </BaseDrawerClose>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">{children}</div>
      </BaseDrawerContent>
    </>
  );
}

/** The row of actions at the end of the drawer: the main action last (the left in Arabic). */
export function DrawerActions({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        // Pinned under the scrolling body: the body's padding is cancelled at its sides and end.
        'sticky bottom-0 -mx-6 -mb-6 mt-auto flex flex-wrap justify-end gap-3 border-t border-border-default bg-bg-surface px-6 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface DrawerCloseProps {
  variant?: ButtonVariant | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A Button that closes the drawer without doing anything («إلغاء»). */
export function DrawerClose({ variant, className, children }: DrawerCloseProps) {
  return (
    <BaseDrawerClose className={cn(buttonClasses({ variant: variant ?? 'secondary' }), className)}>
      <span className="min-w-0">{children}</span>
    </BaseDrawerClose>
  );
}
