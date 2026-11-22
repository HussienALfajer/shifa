// Accordion (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Overlays and navigation · 0.4-06"): sections of a record in one card (radius
// 12, a light border, lines between sections); each header a 48 px button (32 compact) inside a
// heading, the caret at the logical end, turned over and the text heavier when open. Behaviour from
// UI SDK's Accordion: Enter and Space, one section open by default, several with `multiple`, the
// panel named by its header. UI SDK follows the current APG and moves no focus with the arrows;
// the sheet promised them, so this wrapper adds the vertical arrows, Home and End between headers
// (skipping a disabled one), as the APG's optional pattern does. Tab still reaches every header.
import {
  Accordion as BaseAccordion,
  AccordionHeader as BaseAccordionHeader,
  AccordionItem as BaseAccordionItem,
  AccordionPanel as BaseAccordionPanel,
  AccordionTrigger as BaseAccordionTrigger,
} from '@ui-sdk/react/accordion';
import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export interface AccordionProps {
  /** The open sections, when the parent owns them. */
  value?: string[] | undefined;
  /** The sections open at first (none when left out). */
  defaultValue?: string[] | undefined;
  onValueChange?: ((value: string[]) => void) | undefined;
  /** Several sections open at once; one at a time by default. */
  multiple?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

const TRIGGER_SELECTOR = '[data-slot="accordion-trigger"]';
const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

export function Accordion({
  value,
  defaultValue,
  onValueChange,
  multiple,
  className,
  children,
}: AccordionProps) {
  const root = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = MOVES[event.key];
    const here = root.current;
    if (move === undefined || here === null) return;
    const headers = [...here.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR)].filter(
      // This accordion's own headers, not a nested one's; a disabled header is skipped.
      (el) => el.closest('[data-slot="accordion"]') === here && !el.hasAttribute('data-disabled'),
    );
    const index = headers.indexOf(event.target as HTMLElement);
    if (index === -1) return;
    event.preventDefault();
    headers[move(index, headers.length)]?.focus();
  };
  return (
    <BaseAccordion
      ref={root}
      onKeyDown={onKeyDown}
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(multiple === undefined ? {} : { multiple })}
      {...(onValueChange === undefined
        ? {}
        : {
            onValueChange: (next: string[]) => {
              onValueChange(next);
            },
          })}
      className={cn(
        'overflow-hidden rounded-surface border border-border-default bg-bg-surface text-text-default',
        className,
      )}
    >
      {children}
    </BaseAccordion>
  );
}

export interface AccordionItemProps {
  value: string;
  /** The header text; it names the section's panel. */
  title: ReactNode;
  /** A short count or tag before the caret («4»). */
  badge?: ReactNode | undefined;
  /** Reachable by Tab, announced as disabled, never opened. */
  disabled?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

const TRIGGER = cn(
  'flex w-full min-h-(--shifa-size-row) items-center gap-3 border-0 bg-transparent px-4 text-start',
  'font-ui text-body font-medium leading-heading text-text-default in-data-[density=compact]:px-3 in-data-[density=compact]:text-200',
  'cursor-pointer select-none transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  'hover:bg-selection-subtle data-open:font-semibold',
  'data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:text-text-disabled',
  // Inside the card, which clips: the ring is drawn inward.
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus focus-visible:transition-none',
);

const CARET = cn(
  'ms-auto text-icon-muted transition-transform duration-(--shifa-motion-duration-base) ease-standard',
  'in-data-open:rotate-180 in-data-disabled:text-text-disabled motion-reduce:transition-none',
);

export function AccordionItem({
  value,
  title,
  badge,
  disabled,
  className,
  children,
}: AccordionItemProps) {
  // The header is named by its title alone and the badge is read after it as its description.
  // The badge sits outside the button, drawn over its end before the caret, so the button's
  // visible text is its name (WCAG 2.5.3 label in name).
  const badgeId = useId();
  return (
    <BaseAccordionItem
      value={value}
      {...(disabled === undefined ? {} : { disabled })}
      className={cn('border-t border-border-default first:border-t-0', className)}
    >
      <BaseAccordionHeader className="relative m-0">
        <BaseAccordionTrigger
          className={cn(TRIGGER, badge !== undefined && 'pe-16')}
          {...(badge === undefined ? {} : { 'aria-describedby': badgeId })}
        >
          <span className="min-w-0">{title}</span>
          <Icon name="caret-down" className={CARET} />
        </BaseAccordionTrigger>
        {badge !== undefined && (
          <span
            id={badgeId}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 end-11 flex items-center in-data-[density=compact]:end-10"
          >
            <span className="inline-flex min-w-6 items-center justify-center rounded-pill bg-status-neutral-bg px-2 text-caption font-semibold leading-heading text-status-neutral-fg tabular-nums">
              {badge}
            </span>
          </span>
        )}
      </BaseAccordionHeader>
      <BaseAccordionPanel
        className={cn(
          'h-(--accordion-panel-height) overflow-hidden',
          // transition-all: the theme has no height-only transition; the panel changes nothing else.
          'transition-all duration-(--shifa-motion-duration-base) ease-standard',
          'data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none',
        )}
      >
        <div className="px-4 pb-4 font-ui text-data leading-body in-data-[density=compact]:px-3 in-data-[density=compact]:pb-2">
          {children}
        </div>
      </BaseAccordionPanel>
    </BaseAccordionItem>
  );
}
