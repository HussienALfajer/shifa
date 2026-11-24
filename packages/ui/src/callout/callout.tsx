// Callout (slice A-01-07), as the owner approved the sheet on 2026-11-24 ("Shifa Screens · Clinic
// web", page "A-01-07 Sign-in batch", `CalloutSheet`, ADR-0046): a message inside the page that
// stays while its cause holds (a lock, a blocked network, a server out of reach, a session that
// ended, a suspended clinic). Not a Toast (that passes), not a field error (under the field), not
// an AlertDialog (asks nothing). Locked status colours, an icon and words, never colour alone; an
// optional title, the text, at most one action at the end of the line, no close button.
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<CalloutTone, { box: string; icon: string; glyph: IconName }> = {
  info: {
    box: 'border-status-info-border bg-status-info-bg',
    icon: 'text-status-info-fg',
    glyph: 'info',
  },
  success: {
    box: 'border-status-success-border bg-status-success-bg',
    icon: 'text-status-success-fg',
    glyph: 'check-circle',
  },
  warning: {
    box: 'border-status-warning-border bg-status-warning-bg',
    icon: 'text-status-warning-fg',
    glyph: 'warning',
  },
  danger: {
    box: 'border-status-danger-border bg-status-danger-bg',
    icon: 'text-status-danger-fg',
    glyph: 'x-circle',
  },
};

export interface CalloutProps {
  /** info (default), success, warning, danger: the locked status colours; the clinic's colour never changes them. */
  tone?: CalloutTone;
  /** A one-line title in weight 500. */
  title?: ReactNode;
  /**
   * One or two sentences. The message is a live region: a ticking countdown goes in an
   * `aria-hidden` span beside a fixed `sr-only` sentence, or it is announced each second.
   */
  children: ReactNode;
  /** Replaces the tone's icon (`clock` for a lock, `wifi-slash` for the network). */
  icon?: IconName;
  /** At most one button (sm, secondary) at the end of the line, such as «إعادة المحاولة». */
  action?: ReactNode;
  className?: string;
  /** `data-*` hooks for the page (tests, journeys) go onto the message. */
  [data: `data-${string}`]: string | undefined;
}

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  action,
  className,
  ...data
}: CalloutProps) {
  const look = TONE[tone];
  return (
    <div
      {...data}
      data-slot="callout"
      data-tone={tone}
      // warning and danger follow an action and must be heard; info and success are a status.
      role={tone === 'warning' || tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-input border px-4 py-3 font-ui text-text-default',
        'in-data-[density=compact]:gap-2 in-data-[density=compact]:px-3 in-data-[density=compact]:py-2',
        look.box,
        className,
      )}
    >
      <span className={cn('flex shrink-0 pt-0.5', look.icon)}>
        <Icon name={icon ?? look.glyph} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {title !== undefined && (
          <span data-slot="callout-title" className="text-data leading-body font-medium">
            {title}
          </span>
        )}
        <span className="text-data leading-body">{children}</span>
      </span>
      {action !== undefined && <span className="shrink-0 self-center">{action}</span>}
    </div>
  );
}
