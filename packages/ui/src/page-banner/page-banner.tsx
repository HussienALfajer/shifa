// PageBanner (A-02-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Clinic
// web", page "Proposals", A02cSheetPageBanner): a strip the width of the page, above the top bar
// on every page of clinic web: announcements (info, warning), the owner's notice that support is
// reading the clinic, and the support session's own solid strip. The locked status colours with
// an icon and a word (never colour alone), the text, at most one action, a pager «1 من 3» for
// several announcements, and a named close button only where the banner can be hidden. Several
// banners stack in the caller's order: the support session, then the owner's notice, then
// announcements. On a phone the text takes a whole line and the buttons go under it.
import type { ReactNode } from 'react';
import { IconButton } from '../icon-button/icon-button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { useDirection } from '../providers/direction-provider.tsx';

export type PageBannerTone = 'info' | 'warning' | 'support';

const TONE: Record<PageBannerTone, { box: string; glyph: IconName }> = {
  info: {
    box: 'border-status-info-border bg-status-info-bg text-status-info-fg',
    glyph: 'info',
  },
  warning: {
    box: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
    glyph: 'warning',
  },
  support: {
    box: 'border-status-info-solid bg-status-info-solid text-status-info-on-solid',
    glyph: 'eye',
  },
};

const WORDS = {
  rtl: {
    previous: 'الإعلان السابق',
    next: 'الإعلان التالي',
    dismiss: 'إخفاء الإعلان',
    of: (i: number, n: number) => `${String(i)} من ${String(n)}`,
  },
  ltr: {
    previous: 'Previous announcement',
    next: 'Next announcement',
    dismiss: 'Hide the announcement',
    of: (i: number, n: number) => `${String(i)} of ${String(n)}`,
  },
} as const;

export interface PageBannerPager {
  /** The shown one, from 0. */
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
  previousLabel?: string;
  nextLabel?: string;
}

export interface PageBannerProps {
  /** info and warning for announcements; support, solid, for the support session's strip. */
  tone: PageBannerTone;
  /** The word or sentence in bold that says what it is («تنبيه:»); it also names the region. */
  title: string;
  /** The text after it. It is read again when it changes (the pager), never on its own. */
  children?: ReactNode;
  /** Replaces the tone's icon (`eye` for the owner's notice that support is reading). */
  icon?: IconName;
  /** At most one small button («إنهاء الدخول»). */
  action?: ReactNode;
  /** Several announcements in turn: «1 من 3» between previous and next. */
  pager?: PageBannerPager;
  /** A close button; leave it out where the banner cannot be hidden (support). */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** The region's name when it should differ from `title`. */
  'aria-label'?: string;
  className?: string;
}

export function PageBanner({
  tone,
  title,
  children,
  icon,
  action,
  pager,
  onDismiss,
  dismissLabel,
  className,
  ...props
}: PageBannerProps) {
  const words = WORDS[useDirection()];
  const { box, glyph } = TONE[tone];
  return (
    <div
      role="region"
      aria-label={props['aria-label'] ?? title}
      className={cn('@container', className)}
    >
      <div
        data-slot="page-banner-box"
        className={cn(
          'flex min-h-(--shifa-size-control-md) flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2',
          '@pagination:flex-nowrap @pagination:px-4 in-data-[density=compact]:py-1',
          'font-ui text-data leading-body',
          box,
        )}
      >
        {/* Narrow (under 430 px, a phone): this group takes the line; the buttons wrap under it. */}
        <div className="flex min-w-0 basis-full items-center gap-3 @pagination:flex-1 @pagination:basis-0">
          <Icon name={icon ?? glyph} />
          <p aria-live="polite" className="m-0 flex min-w-0 flex-1 flex-wrap gap-x-2">
            <strong className="font-semibold">{title}</strong>
            {children !== undefined && <span>{children}</span>}
          </p>
        </div>
        {pager !== undefined && (
          <span
            data-slot="page-banner-pager"
            className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums"
          >
            <IconButton
              icon="caret-back"
              variant="ghost"
              size="sm"
              label={pager.previousLabel ?? words.previous}
              disabled={pager.index <= 0}
              onClick={() => {
                pager.onIndexChange(pager.index - 1);
              }}
            />
            <span>{words.of(pager.index + 1, pager.count)}</span>
            <IconButton
              icon="caret-forward"
              variant="ghost"
              size="sm"
              label={pager.nextLabel ?? words.next}
              disabled={pager.index >= pager.count - 1}
              onClick={() => {
                pager.onIndexChange(pager.index + 1);
              }}
            />
          </span>
        )}
        {action}
        {onDismiss !== undefined && (
          <IconButton
            icon="x"
            variant="ghost"
            size="sm"
            label={dismissLabel ?? words.dismiss}
            onClick={() => {
              onDismiss();
            }}
          />
        )}
      </div>
    </div>
  );
}
