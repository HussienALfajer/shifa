// Icon Button (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): a square Button with one icon and no visible
// text, in the Button's variants; md 44 px and sm 36 px (32 and 28 compact). With no text its
// name is required. `tooltip` shows that name in a Tooltip (slice 0.4-06): the tooltip says the
// same words, so it names the button instead of describing it twice.
import type { ComponentProps, MouseEvent } from 'react';
import { Button, type ButtonVariant } from '../button/button.tsx';
import type { IconName } from '../icons/icon.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';

type NativeProps = Omit<
  ComponentProps<'button'>,
  'className' | 'style' | 'children' | 'onClick' | 'type' | 'disabled' | 'aria-label'
>;

export interface IconButtonProps extends NativeProps {
  icon: IconName;
  /** The accessible name: what the button does («تعديل», «إغلاق»). */
  label: string;
  /** secondary (default), ghost, primary, danger: as Button. */
  variant?: ButtonVariant | undefined;
  /** md 44 px (default), sm 36 px for rows and inside fields. */
  size?: 'sm' | 'md' | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  /** Shows the label in a tooltip on hover and keyboard focus (never on touch). */
  tooltip?: boolean | undefined;
  type?: 'button' | 'submit' | 'reset' | undefined;
  onClick?: ((event: MouseEvent<HTMLElement>) => unknown) | undefined;
  className?: string | undefined;
}

export function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  tooltip = false,
  type = 'button',
  onClick,
  className,
  ...native
}: IconButtonProps) {
  const button = (
    <Button
      {...native}
      startIcon={icon}
      aria-label={label}
      variant={variant}
      size={size}
      disabled={disabled}
      loading={loading}
      type={type}
      {...(onClick === undefined ? {} : { onClick })}
      {...(className === undefined ? {} : { className })}
    />
  );
  if (!tooltip) return button;
  return (
    <Tooltip content={label} type="label">
      {button}
    </Tooltip>
  );
}
