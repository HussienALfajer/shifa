// Button (slice 0.4-03), as the owner approved its sheet on 2026-11-20 ("Shifa Components
// (proposals)", page Button): four variants, three sizes, both densities, the icon on the logical
// start. Behaviour comes from UI SDK's Button (keyboard, disabled, pending); styling from tokens.
import { Button as BaseButton } from '@ui-sdk/react/button';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon.tsx';
import { Spinner } from '../icons/spinner.tsx';
import { cn } from '../lib/cn.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type NativeProps = Omit<
  ComponentProps<'button'>,
  'className' | 'style' | 'children' | 'onClick' | 'type' | 'disabled'
>;

interface CommonProps extends NativeProps {
  /** primary: the one main action of a view; secondary (default); ghost: light actions inside cards and tables; danger: actions that delete or cancel. */
  variant?: ButtonVariant;
  /** sm 36, md 44 (default), lg 52 px high; 28, 32, 40 in the compact density. */
  size?: ButtonSize;
  /** An icon before the label, on the logical start (the right in Arabic). */
  startIcon?: IconName;
  /** An icon after the label, on the logical end ("Next" with a forward arrow). */
  endIcon?: IconName;
  /** Busy: keeps the label and its place, shows a spinner first, ignores presses, stays focusable. */
  loading?: boolean;
  /** Stops presses and leaves the tab order. */
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Runs on a press. A returned Promise keeps the button busy until it settles (no double submit). */
  onClick?: ((event: MouseEvent<HTMLElement>) => unknown) | undefined;
  /** What screen readers hear when a press is still running after a second (Arabic by default). */
  pendingAnnouncement?: string;
  className?: string;
}

/** A button with a visible label. */
interface LabelledProps extends CommonProps {
  children: ReactNode;
}

/** An icon-only button: square, named by `aria-label`. */
interface IconOnlyProps extends CommonProps {
  children?: undefined;
  startIcon: IconName;
  'aria-label': string;
}

export type ButtonProps = LabelledProps | IconOnlyProps;

const BASE = cn(
  'relative inline-flex max-w-full items-center justify-center gap-2 py-0.5',
  'rounded-control border font-ui font-medium text-center',
  'cursor-pointer select-none transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  // The focus ring appears at once: transition-colors would fade outline-color in from the text.
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:transition-none',
);

const SIZES: Record<
  ButtonSize,
  { box: string; iconOnly: string; icon: 'sm' | 'md'; iconClass?: string }
> = {
  sm: {
    box: cn('min-h-(--shifa-size-control-sm) px-3 text-200 in-data-[density=compact]:px-2'),
    iconOnly: cn('w-(--shifa-size-control-sm) px-0'),
    icon: 'sm',
  },
  md: {
    box: cn('min-h-(--shifa-button-height) px-(--shifa-button-padding-inline) text-body'),
    iconOnly: cn('w-(--shifa-button-height) px-0'),
    icon: 'sm',
  },
  lg: {
    box: cn(
      'min-h-(--shifa-size-control-lg) px-5 text-400',
      'in-data-[density=compact]:px-4 in-data-[density=compact]:text-300',
    ),
    iconOnly: cn('w-(--shifa-size-control-lg) px-0'),
    icon: 'md',
    iconClass: cn('in-data-[density=compact]:size-(--shifa-size-icon-sm)'),
  },
};

/** Resting colours, and the hover and press colours used only while the button can be pressed. */
const VARIANTS: Record<ButtonVariant, { rest: string; live: string; disabled: string }> = {
  primary: {
    rest: cn('border-transparent bg-(--shifa-button-primary-bg) text-(--shifa-button-primary-fg)'),
    live: cn(
      'hover:bg-(--shifa-button-primary-bg-hover) active:bg-(--shifa-button-primary-bg-pressed)',
    ),
    disabled: cn('border-border-default bg-bg-surface-raised text-text-disabled'),
  },
  secondary: {
    rest: cn('border-border-strong bg-bg-surface text-text-default'),
    live: cn('hover:bg-selection-subtle active:bg-selection-default'),
    disabled: cn('border-border-default bg-bg-surface-raised text-text-disabled'),
  },
  ghost: {
    rest: cn('border-transparent bg-transparent text-brand-primary'),
    live: cn('hover:bg-selection-subtle active:bg-selection-default'),
    disabled: cn('border-transparent bg-transparent text-text-disabled'),
  },
  danger: {
    rest: cn('border-transparent bg-status-danger-solid text-status-danger-on-solid'),
    live: cn('hover:bg-status-danger-fg active:bg-status-danger-fg'),
    disabled: cn('border-border-default bg-bg-surface-raised text-text-disabled'),
  },
};

/** The 1 px press of the sheet; none under reduced motion. */
const PRESS = cn('active:translate-y-px motion-reduce:active:translate-y-0');

export function Button({
  variant = 'secondary',
  size = 'md',
  startIcon,
  endIcon,
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  pendingAnnouncement = 'جارٍ التنفيذ',
  className,
  children,
  ...native
}: ButtonProps) {
  const look = VARIANTS[variant];
  const box = SIZES[size];
  const iconOnly = children === undefined;
  return (
    <BaseButton
      {...native}
      type={type}
      // Loading keeps focus and its colours: disabled for presses, focusable, aria-disabled.
      disabled={disabled || loading}
      focusableWhenDisabled={loading && !disabled}
      pendingAnnouncement={pendingAnnouncement}
      aria-busy={loading || undefined}
      {...(onClick === undefined ? {} : { onClick })}
      className={(state) => {
        const inert = state.disabled && !loading;
        const busy = loading || state.pending;
        return cn(
          BASE,
          box.box,
          // After the size: tailwind-merge drops a line height that comes before a text size.
          'leading-heading',
          iconOnly && box.iconOnly,
          inert ? look.disabled : look.rest,
          inert ? 'cursor-not-allowed' : busy ? 'cursor-progress' : cn(look.live, PRESS),
          className,
        );
      }}
    >
      {(state) => (
        <>
          {loading || state.pending ? (
            <span data-slot="spinner" className="inline-flex shrink-0">
              <Spinner size={box.icon} className={box.iconClass} />
            </span>
          ) : (
            startIcon !== undefined && (
              <Icon name={startIcon} size={box.icon} className={box.iconClass} />
            )
          )}
          {!iconOnly && (
            <span data-slot="label" className="min-w-0">
              {children}
            </span>
          )}
          {endIcon !== undefined && (
            <Icon name={endIcon} size={box.icon} className={box.iconClass} />
          )}
        </>
      )}
    </BaseButton>
  );
}
