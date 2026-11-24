// A link that looks like a Button (slice A-01-10 checkpoint 3): «إنشاء عيادة» and the 404 page's
// way back go to a page, so they are links (open in a new tab, Enter, the address in the status
// bar), drawn with Button's primary or secondary look from the same tokens. @shifa/ui has no link
// button yet (backlog: drawn and built with /ui-component); until then this is the one copy.
import { cn, Icon, type IconName } from '@shifa/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const BASE = cn(
  'relative inline-flex max-w-full items-center justify-center gap-2 py-0.5 no-underline',
  'min-h-(--shifa-button-height) px-(--shifa-button-padding-inline) text-body leading-heading',
  'rounded-control border font-ui font-medium text-center',
  'transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:transition-none',
);

const LOOK = {
  primary: cn(
    'border-transparent bg-(--shifa-button-primary-bg) text-(--shifa-button-primary-fg)',
    'hover:bg-(--shifa-button-primary-bg-hover) active:bg-(--shifa-button-primary-bg-pressed)',
  ),
  secondary: cn(
    'border-border-strong bg-bg-surface text-text-default',
    'hover:bg-selection-subtle active:bg-selection-default',
  ),
} as const;

export function ButtonLink({
  to,
  variant = 'secondary',
  icon,
  children,
}: {
  to: '/' | '/clinics/new';
  variant?: keyof typeof LOOK;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(BASE, LOOK[variant])}>
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </Link>
  );
}
