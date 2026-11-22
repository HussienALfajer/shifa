// Alert dialog (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Overlays and navigation · 0.4-06"): the Dialog's panel (radius 16, the modal
// shadow, the overlay colour behind, 480 px) for a question that needs an explicit answer. A
// status mark (danger or info) before the title, which is a question; one or two sentences; then
// «رجوع» and the action last (the left in Arabic), in the danger look for a deletion. No close
// button. Behaviour from UI SDK's AlertDialog: always modal, never closed by a press outside,
// focus on the first Cancel (the least harmful answer), Escape and Cancel close it and focus
// returns to the trigger. An action that returns a Promise keeps it open and busy; a failure keeps
// it open and shows the caller's message.
import {
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialog as BaseAlertDialog,
  AlertDialogClose as BaseAlertDialogClose,
  AlertDialogContent as BaseAlertDialogContent,
  AlertDialogTrigger as BaseAlertDialogTrigger,
} from '@ui-sdk/react/alert-dialog';
import { type ReactNode, useState } from 'react';
import { type ButtonVariant, buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { SpinnerMark } from '../spinner/spinner.tsx';

export interface AlertDialogProps {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** What screen readers hear when the action still runs after a second (Arabic by default). */
  pendingAnnouncement?: string | undefined;
  children: ReactNode;
}

export function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  pendingAnnouncement = 'جارٍ التنفيذ',
  children,
}: AlertDialogProps) {
  return (
    <BaseAlertDialog
      pendingAnnouncement={pendingAnnouncement}
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
    </BaseAlertDialog>
  );
}

export interface AlertDialogTriggerProps {
  variant?: ButtonVariant | undefined;
  startIcon?: IconName | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A Button that asks the question. */
export function AlertDialogTrigger({
  variant,
  startIcon,
  disabled,
  className,
  children,
}: AlertDialogTriggerProps) {
  return (
    <BaseAlertDialogTrigger
      {...(disabled === undefined ? {} : { disabled })}
      className={cn(buttonClasses({ variant: variant ?? 'secondary' }), className)}
    >
      {startIcon !== undefined && <Icon name={startIcon} />}
      <span className="min-w-0">{children}</span>
    </BaseAlertDialogTrigger>
  );
}

const TONES = {
  danger: { icon: 'warning', mark: 'bg-status-danger-bg text-status-danger-fg' },
  info: { icon: 'info', mark: 'bg-status-info-bg text-status-info-fg' },
} as const satisfies Record<string, { icon: IconName; mark: string }>;

export interface AlertDialogContentProps {
  /** The question («حذف الوصفة؟»); it names the dialog. */
  title: ReactNode;
  /** One or two sentences: what happens, and whether it can be undone. */
  description?: ReactNode | undefined;
  /** The mark before the title: danger (a deletion, the default) or info. */
  tone?: keyof typeof TONES | undefined;
  className?: string | undefined;
  /** AlertDialogCancel first, then AlertDialogAction. */
  children: ReactNode;
}

export function AlertDialogContent({
  title,
  description,
  tone = 'danger',
  className,
  children,
}: AlertDialogContentProps) {
  const look = TONES[tone];
  return (
    <BaseAlertDialogContent
      className={cn(
        'fixed inset-4 m-auto h-fit max-h-full w-(--shifa-size-dialog) max-w-full overflow-y-auto',
        'flex flex-col gap-4 rounded-overlay bg-bg-surface p-(--shifa-inset-surface) text-text-default shadow-modal',
        'font-ui text-body leading-body',
        'backdrop:bg-bg-overlay',
        'transition duration-(--shifa-motion-duration-slow) ease-enter',
        'data-starting-style:translate-y-2 data-starting-style:opacity-0',
        'data-ending-style:translate-y-2 data-ending-style:opacity-0',
        'motion-reduce:transition-none motion-reduce:duration-0',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            look.mark,
          )}
        >
          <Icon name={look.icon} />
        </span>
        <AlertDialogTitle className="m-0 min-w-0 flex-1 pt-2 text-heading-sm font-semibold leading-heading">
          {title}
        </AlertDialogTitle>
      </div>
      {description !== undefined && (
        <AlertDialogDescription className="m-0 text-body leading-body text-text-muted">
          {description}
        </AlertDialogDescription>
      )}
      {/* A failed action puts its message first on this row, on a line of its own. */}
      <div className="flex flex-wrap justify-end gap-3">{children}</div>
    </BaseAlertDialogContent>
  );
}

export interface AlertDialogCancelProps {
  className?: string | undefined;
  children: ReactNode;
}

/** The least harmful answer («رجوع»): first in the row, focused when the dialog opens. */
export function AlertDialogCancel({ className, children }: AlertDialogCancelProps) {
  return (
    <BaseAlertDialogClose
      className={(state) =>
        cn(
          buttonClasses({ variant: 'secondary' }),
          state.pending && 'cursor-not-allowed opacity-60',
          className,
        )
      }
    >
      <span className="min-w-0">{children}</span>
    </BaseAlertDialogClose>
  );
}

export interface AlertDialogActionProps {
  /** danger for a deletion or a cancellation (the default), primary for an ordinary confirmation. */
  variant?: 'danger' | 'primary' | undefined;
  /** Runs before the dialog closes; a returned Promise keeps it open and busy until it settles. */
  onAction?: (() => unknown) | undefined;
  /** Shown above the actions when `onAction` fails; the dialog stays open. */
  errorText?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** The answer that acts: last in the row (the left in Arabic). */
export function AlertDialogAction({
  variant = 'danger',
  onAction,
  errorText,
  className,
  children,
}: AlertDialogActionProps) {
  const [failed, setFailed] = useState(false);
  const run = async () => {
    setFailed(false);
    try {
      await onAction?.();
    } catch (error) {
      // Rethrown: UI SDK keeps the dialog open on a rejection.
      setFailed(true);
      throw error;
    }
  };
  return (
    <>
      {failed && errorText !== undefined && (
        <p
          role="alert"
          className="order-first m-0 flex basis-full items-center gap-1 text-data leading-body text-status-danger-fg"
        >
          <Icon name="warning" />
          {errorText}
        </p>
      )}
      <BaseAlertDialogClose
        value="confirm"
        action={run}
        className={cn(buttonClasses({ variant }), 'data-pending:cursor-progress', className)}
      >
        {(state) => (
          <>
            {state.pending && <SpinnerMark />}
            <span className="min-w-0">{children}</span>
          </>
        )}
      </BaseAlertDialogClose>
    </>
  );
}
