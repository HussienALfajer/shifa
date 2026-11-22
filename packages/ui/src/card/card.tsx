// Card (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07"): a white surface on cream with an optional
// header (title, description, actions), a body and a footer; padding 24, radius 12, the card
// shadow, and in dark the border carries it. Not interactive by itself. A link card puts one real
// link (CardLink) in its title: the whole card is its hit area and its focus ring is drawn on
// the card, while buttons in the card stay their own controls. A press on the
// card outside any control is passed to the link (the text stays selectable: no overlay).
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [tabindex]';

/** Passes a press on the card, outside any control and not ending a text selection, to its link. */
function followLink(event: MouseEvent<HTMLDivElement>) {
  const link = event.currentTarget.querySelector<HTMLAnchorElement>('[data-slot="card-link"]');
  if (link === null || event.defaultPrevented) return;
  const target = event.target as Element;
  if (target.closest(INTERACTIVE) !== null) return;
  if ((window.getSelection()?.toString() ?? '') !== '') return;
  link.dispatchEvent(
    new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      button: event.button,
    }),
  );
}

export function Card({ children, className }: CardProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the link inside is the control; this only widens its hit area for pointers
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users reach the link itself
    <div
      data-slot="card"
      onClick={followLink}
      className={cn(
        'relative flex min-w-0 flex-col rounded-surface border border-(--shifa-card-border) bg-(--shifa-card-bg) shadow-card',
        'font-ui text-text-default',
        // A link card: hover lifts the surface; the link's keyboard focus rings the whole card.
        'has-[[data-slot=card-link]]:cursor-pointer has-[[data-slot=card-link]]:transition-colors has-[[data-slot=card-link]]:duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
        'has-[[data-slot=card-link]]:hover:border-border-strong has-[[data-slot=card-link]]:hover:bg-selection-subtle',
        'has-[[data-slot=card-link]:focus-visible]:shadow-focus has-[[data-slot=card-link]:focus-visible]:outline-2 has-[[data-slot=card-link]:focus-visible]:outline-offset-2 has-[[data-slot=card-link]:focus-visible]:outline-border-focus has-[[data-slot=card-link]:focus-visible]:transition-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

type HeadingLevel = 2 | 3 | 4;

export interface CardHeaderProps {
  /** The title: text, or a CardLink for a link card. */
  title: ReactNode;
  description?: ReactNode;
  /** Buttons at the logical end of the header; they stay above a link card's hit area. */
  actions?: ReactNode;
  /** The title's heading level (3 by default). */
  headingLevel?: HeadingLevel;
}

export function CardHeader({ title, description, actions, headingLevel = 3 }: CardHeaderProps) {
  const Heading = `h${String(headingLevel)}` as 'h3';
  return (
    <div className="flex items-start gap-3 px-(--shifa-card-padding) pt-(--shifa-card-padding)">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Heading className="m-0 text-heading-sm leading-heading font-semibold">{title}</Heading>
        {description !== undefined && (
          <p className="m-0 text-data leading-body text-text-muted">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-(--shifa-card-padding) py-4 text-data leading-body',
        'first:pt-(--shifa-card-padding) last:pb-(--shifa-card-padding)',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-border-default px-(--shifa-card-padding) py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type CardLinkProps = Omit<ComponentProps<'a'>, 'className' | 'style'> & {
  href: string;
  children: ReactNode;
};

/** The one link of a link card; the whole card is its hit area. */
export function CardLink({ children, ...rest }: CardLinkProps) {
  return (
    <a data-slot="card-link" {...rest} className="text-text-default no-underline outline-none">
      {children}
    </a>
  );
}
