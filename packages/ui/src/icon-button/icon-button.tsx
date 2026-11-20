// Icon Button (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): a square Button with one icon and no visible
// text, in the Button's variants; md 44 px and sm 36 px (32 and 28 compact). With no text its
// name is required. A tooltip showing the name joins with the Tooltip of slice 0.4-06.
import type { MouseEvent } from 'react';
import { Button, type ButtonVariant } from '../button/button.tsx';
import type { IconName } from '../icons/icon.tsx';

export interface IconButtonProps {
  icon: IconName;
  /** The accessible name: what the button does («تعديل», «إغلاق»). */
  label: string;
  /** secondary (default), ghost, primary, danger: as Button. */
  variant?: ButtonVariant | undefined;
  /** md 44 px (default), sm 36 px for rows and inside fields. */
  size?: 'sm' | 'md' | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
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
  type = 'button',
  onClick,
  className,
}: IconButtonProps) {
  return (
    <Button
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
}
