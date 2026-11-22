// Toast (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Overlays and navigation · 0.4-06") with OD-63: a small white card (radius
// 12, a light border, the dropdown shadow), 360 px (the screen less 16 px a side on a phone), at
// the bottom of the screen at the logical end (the bottom left in Arabic), three at most with the
// newest at the bottom; the rest wait. A status toast has its icon and words, never colour alone.
// Success and info close after 5 s, warning after 8 s, errors stay until closed. Behaviour from
// UI SDK's Toast: one region per app, announced politely (errors assertively) through its own
// live regions, timers paused while the pointer or focus is on the toasts, Escape closes a focused
// toast, F6 reaches them. Messages are the caller's text (an i18n key already translated).
import {
  ToastAction as BaseToastAction,
  ToastClose as BaseToastClose,
  Toast as BaseToastItem,
  ToastRegion as BaseToastRegion,
  createToaster,
  ToastDescription,
  ToastTitle,
} from '@ui-sdk/react/toast';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export type ToastType = 'default' | 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  /** The message: the caller's text, never built here. */
  title: string;
  /** One more line under the title. */
  description?: string | undefined;
  /** success, info, warning and error carry their icon; default has none. */
  type?: ToastType | undefined;
  /** One verb («تراجع», «إعادة المحاولة»); a returned Promise keeps the toast until it settles. */
  action?: { label: string; onAction?: (() => unknown) | undefined } | undefined;
  /** In ms; `Infinity` keeps it until it is closed. By type when left out (OD-63). */
  duration?: number | undefined;
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  show: (options: ToastOptions) => string;
  /** Closes one toast, or every toast without an id. */
  dismiss: (id?: string) => void;
}

/** How long each type stays (OD-63): errors until closed. */
const DURATION: Record<ToastType, number> = {
  default: 5000,
  success: 5000,
  info: 5000,
  warning: 8000,
  error: Number.POSITIVE_INFINITY,
};

const ICON: Partial<Record<ToastType, { name: IconName; colour: string }>> = {
  success: { name: 'check-circle', colour: 'text-status-success-fg' },
  info: { name: 'info', colour: 'text-status-info-fg' },
  warning: { name: 'warning', colour: 'text-status-warning-fg' },
  error: { name: 'x-circle', colour: 'text-status-danger-fg' },
};

const ToastContext = createContext<ToastApi | null>(null);

/** The toasts of the app: `show` and `dismiss`. Needs a ToastProvider above. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error('@shifa/ui: useToast needs a ToastProvider above it');
  return api;
}

export interface ToastProviderProps {
  /** The region's name for screen readers. */
  label?: string | undefined;
  /** The name of each toast's close button. */
  closeLabel?: string | undefined;
  /** What screen readers hear when an action still runs after a second. */
  pendingAnnouncement?: string | undefined;
  children: ReactNode;
}

const TOAST = cn(
  'relative flex w-full items-start gap-3 py-3 ps-4 pe-2 select-none',
  'rounded-surface border border-border-default bg-bg-surface text-text-default shadow-dropdown',
  'font-ui text-body leading-body',
  'transition duration-(--shifa-motion-duration-base) ease-enter',
  'data-starting-style:translate-y-2 data-starting-style:opacity-0',
  'data-ending-style:opacity-0 data-ending-style:duration-(--shifa-motion-duration-fast)',
  'motion-reduce:transition-opacity motion-reduce:data-starting-style:translate-y-0',
);

/** One region for the app: place it once, beside the other providers. */
export function ToastProvider({
  label = 'الإشعارات',
  closeLabel = 'إغلاق الإشعار',
  pendingAnnouncement = 'جارٍ التنفيذ',
  children,
}: ToastProviderProps) {
  const [toaster] = useState(() => createToaster());
  useEffect(
    () => () => {
      toaster.dismiss();
    },
    [toaster],
  );
  const api = useMemo<ToastApi>(
    () => ({
      show: ({ title, description, type = 'default', action, duration }) =>
        toaster({
          title,
          type,
          duration: duration ?? DURATION[type],
          priority: type === 'error' ? 'assertive' : 'polite',
          ...(description === undefined ? {} : { description }),
          ...(action === undefined
            ? {}
            : {
                action: {
                  label: action.label,
                  ...(action.onAction === undefined ? {} : { onAction: () => action.onAction?.() }),
                },
              }),
        }),
      dismiss: (id) => {
        toaster.dismiss(id);
      },
    }),
    [toaster],
  );
  return (
    <ToastContext value={api}>
      {children}
      <BaseToastRegion
        toaster={toaster}
        side="bottom"
        align="end"
        maxVisible={3}
        expanded
        aria-label={label}
        pendingAnnouncement={pendingAnnouncement}
        className={cn(
          'fixed inset-auto bottom-4 start-4 end-4 z-(--shifa-z-toast) m-0 border-0 bg-transparent p-0',
          'sm:start-auto sm:w-(--shifa-size-toast)',
          // The region holds one list (ol), newest first; drawn bottom up, so the newest sits at
          // the bottom.
          '*:m-0 *:flex *:list-none *:flex-col-reverse *:gap-2 *:p-0',
        )}
      >
        {(toast) => {
          const icon = ICON[toast.type as ToastType];
          return (
            <BaseToastItem className={TOAST}>
              {icon !== undefined && (
                <Icon name={icon.name} className={cn('mt-0.5', icon.colour)} />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <ToastTitle className="m-0 text-body font-medium leading-body" />
                <ToastDescription className="m-0 text-200 leading-body text-text-muted" />
                {toast.action !== undefined && (
                  <div className="-ms-3 mt-1 flex">
                    <BaseToastAction className={buttonClasses({ variant: 'ghost', size: 'sm' })} />
                  </div>
                )}
              </div>
              <BaseToastClose
                aria-label={closeLabel}
                className={cn(
                  buttonClasses({ variant: 'ghost', size: 'sm', iconOnly: true }),
                  'text-text-muted',
                )}
              >
                <Icon name="x" />
              </BaseToastClose>
            </BaseToastItem>
          );
        }}
      </BaseToastRegion>
    </ToastContext>
  );
}
