// Dialog (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): one level above the page (radius 16, the modal
// shadow) over the overlay colour; the title with a close button at its logical end; actions at
// the end of the line, the main one last. Behaviour from UI SDK's Dialog: modal, focus trapped,
// Escape closes, focus returns to the trigger. Focus starts on the first field, else on the
// safe action (a DialogClose), else on the close button.
import {
  Dialog as BaseDialog,
  DialogClose as BaseDialogClose,
  DialogContent as BaseDialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger as BaseDialogTrigger,
} from '@ui-sdk/react/dialog';
import { type ReactNode, useRef } from 'react';
import { type ButtonVariant, buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export interface DialogProps {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: ReactNode;
}

export function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  return (
    <BaseDialog
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
    </BaseDialog>
  );
}

export interface DialogTriggerProps {
  variant?: ButtonVariant | undefined;
  startIcon?: IconName | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A Button that opens its dialog. */
export function DialogTrigger({
  variant,
  startIcon,
  disabled,
  className,
  children,
}: DialogTriggerProps) {
  return (
    <BaseDialogTrigger
      {...(disabled === undefined ? {} : { disabled })}
      className={cn(buttonClasses({ variant: variant ?? 'secondary' }), className)}
    >
      {startIcon !== undefined && <Icon name={startIcon} />}
      <span className="min-w-0">{children}</span>
    </BaseDialogTrigger>
  );
}

export interface DialogContentProps {
  /** The heading; it names the dialog. A question for a confirmation («إلغاء الموعد؟»). */
  title: ReactNode;
  /** One or two sentences under the title; read with it. */
  description?: ReactNode | undefined;
  /** The name of the close button, for screen readers. */
  closeLabel?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
}

/** Where focus lands when the dialog opens: a field, else the safe action, else the close button. */
function initialFocus(content: HTMLElement | null): HTMLElement | null {
  if (content === null) return null;
  return (
    content.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select') ??
    content.querySelector<HTMLElement>('[data-slot="dialog-close"][data-safe]') ??
    content.querySelector<HTMLElement>('[data-slot="dialog-close"]')
  );
}

export function DialogContent({
  title,
  description,
  closeLabel = 'إغلاق',
  className,
  children,
}: DialogContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <BaseDialogContent
      ref={ref}
      initialFocus={() => initialFocus(ref.current)}
      className={cn(
        // Centred in the top layer; inset-4 keeps a 16 px margin from the screen's edges.
        'fixed inset-4 m-auto h-fit max-h-full w-(--shifa-size-dialog) max-w-full overflow-y-auto',
        'flex flex-col gap-4 rounded-overlay bg-bg-surface p-(--shifa-inset-surface) text-text-default shadow-modal',
        'font-ui text-body leading-body',
        'backdrop:bg-bg-overlay',
        'transition duration-(--shifa-motion-duration-slow) ease-enter',
        'data-starting-style:translate-y-2 data-starting-style:opacity-0',
        'data-ending-style:translate-y-2 data-ending-style:opacity-0',
        'motion-reduce:transition-none',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <DialogTitle className="m-0 min-w-0 flex-1 text-heading-sm font-semibold leading-heading">
          {title}
        </DialogTitle>
        <BaseDialogClose
          aria-label={closeLabel}
          className={cn(
            buttonClasses({ variant: 'ghost', size: 'sm', iconOnly: true }),
            'text-text-muted',
          )}
        >
          <Icon name="x" />
        </BaseDialogClose>
      </div>
      {description !== undefined && (
        <DialogDescription className="m-0 text-body leading-body text-text-muted">
          {description}
        </DialogDescription>
      )}
      {children}
    </BaseDialogContent>
  );
}

/** The row of actions at the end of a dialog: the main action last (the left in Arabic). */
export function DialogActions({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return <div className={cn('flex flex-wrap justify-end gap-3', className)}>{children}</div>;
}

export interface DialogCloseProps {
  variant?: ButtonVariant | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A Button that closes the dialog without doing anything: the safe action, focused first. */
export function DialogClose({ variant, className, children }: DialogCloseProps) {
  return (
    <BaseDialogClose
      data-safe=""
      className={cn(buttonClasses({ variant: variant ?? 'secondary' }), className)}
    >
      <span className="min-w-0">{children}</span>
    </BaseDialogClose>
  );
}
