// Pagination (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07", OD-64): previous at the logical start and
// next at the end with arrows that mirror in RTL, page numbers with ellipses (the current one
// filled green, aria-current="page"), an optional page-size select (25, 50, 100) and a «عرض 51–75
// من 312» line in Western digits with grouping (OD-20, OD-61). The compact form says «الصفحة 3 من
// 13». Pages and the range come from UI SDK's Pagination; it is controlled and fetches nothing.
// Slice 0.4-12 (OD-66, sheet "Before Phase A · 0.4-12 and 0.4-13", approved 2026-11-23): by default
// the form follows the pagination's own width, a container query at 430 px: below it the compact
// form with the summary on a second line, at or above it the page numbers. Both forms are in the
// markup and the hidden one is display: none, so only one is in the accessibility tree. The
// rows-per-page Select is size.control.select-narrow wide (88 px, 76 px compact).
import {
  Pagination as BasePagination,
  PaginationEllipsis as BasePaginationEllipsis,
  PaginationItem as BasePaginationItem,
  PaginationLink as BasePaginationLink,
  PaginationList as BasePaginationList,
  PaginationNext as BasePaginationNext,
  PaginationPrevious as BasePaginationPrevious,
  paginationRange,
} from '@ui-sdk/react/pagination';
import { buttonClasses } from '../button/button.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { NUMBER_LOCALE } from '../number-input/number-input.tsx';
import { useDirection } from '../providers/direction-provider.tsx';
import { Select } from '../select/select.tsx';

/** One place in the row of pages: a page number or an ellipsis. */
export type PageItem = number | 'ellipsis';

/** The pages to show around `page` of `pageCount`: one at each end, one each side of it. */
export function pageItems(page: number, pageCount: number): PageItem[] {
  return paginationRange({ page, pageCount, siblings: 1, boundaries: 1 }).map((item) =>
    typeof item === 'number' ? item : 'ellipsis',
  );
}

const STEP = cn(
  buttonClasses({ variant: 'ghost', iconOnly: true }),
  'text-text-default',
  'aria-disabled:cursor-not-allowed aria-disabled:bg-transparent aria-disabled:text-text-disabled',
);

const PAGE = cn(
  buttonClasses({ variant: 'ghost' }),
  'min-w-(--shifa-size-control-md) px-2 text-text-default tabular-nums',
  'aria-[current=page]:border-brand-primary aria-[current=page]:bg-brand-primary aria-[current=page]:font-semibold aria-[current=page]:text-brand-on-primary',
  'aria-[current=page]:hover:bg-brand-primary',
);

/** The words of a pagination; Arabic by default. Numbers come formatted, in Western digits. */
export interface PaginationCopy {
  /** «عرض 51–75 من 312». */
  summary: (first: string, last: string, total: string) => string;
  /** The compact form: «الصفحة 3 من 13». */
  position: (page: string, pageCount: string) => string;
  /** A page number's name: «الصفحة 4». */
  page: (page: string) => string;
  previous: string;
  next: string;
  /** The page-size select's label. */
  pageSize: string;
}

const ARABIC: PaginationCopy = {
  summary: (first, last, total) => `عرض ${first}–${last} من ${total}`,
  position: (page, pageCount) => `الصفحة ${page} من ${pageCount}`,
  page: (page) => `الصفحة ${page}`,
  previous: 'الصفحة السابقة',
  next: 'الصفحة التالية',
  pageSize: 'صفوف في الصفحة',
};

/** Shown in one form only: the other is display: none, out of the accessibility tree. */
const ONLY = {
  numbers: 'hidden @pagination:block',
  compact: '@pagination:hidden',
} as const;

export interface PaginationProps {
  /** The current page, from 1. */
  page: number;
  /** Called with the new page; the caller loads it. */
  onPageChange: (page: number) => void;
  /** Rows on a page. */
  pageSize: number;
  /** Rows in the whole list (from the server). */
  totalItems: number;
  /** The choices of the page-size select (25, 50, 100); leave out for no select. */
  pageSizes?: readonly number[];
  /** Called with the new size; the page goes back to 1. */
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * auto (default): the compact form below 430 px of the pagination's own width, the page numbers
   * at or above it. numbers: always page numbers with ellipses; compact: always «الصفحة 3 من 13»
   * between the arrows.
   */
  form?: 'auto' | 'numbers' | 'compact';
  /** The words, for an English screen; Arabic by default. */
  copy?: PaginationCopy;
  /** Hides the «عرض 51–75 من 312» line. */
  hideSummary?: boolean;
  /** The navigation's name. */
  label?: string;
  className?: string;
}

export function Pagination({
  page,
  onPageChange,
  pageSize,
  totalItems,
  pageSizes,
  onPageSizeChange,
  form = 'auto',
  hideSummary = false,
  label = 'ترقيم الصفحات',
  copy = ARABIC,
  className,
}: PaginationProps) {
  const dir = useDirection();
  const number = new Intl.NumberFormat(NUMBER_LOCALE[dir], { useGrouping: true });
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(totalItems, current * pageSize);
  const fmt = (n: number) => number.format(n);
  const showNumbers = form !== 'compact';
  const showCompact = form !== 'numbers';
  const auto = form === 'auto';

  return (
    <div
      className={cn(
        '@container flex flex-wrap items-center justify-between gap-4 font-ui text-text-default',
        className,
      )}
    >
      {!hideSummary && (
        <span
          className={cn(
            'text-data leading-body text-text-muted tabular-nums',
            // Narrow: on its own line under the arrows.
            'order-last basis-full @pagination:order-none @pagination:basis-auto',
          )}
        >
          {copy.summary(fmt(first), fmt(last), fmt(totalItems))}
        </span>
      )}
      <BasePagination
        aria-label={label}
        page={current}
        pageCount={pageCount}
        onPageChange={(next) => {
          onPageChange(next);
        }}
      >
        <BasePaginationList className="m-0 flex list-none items-center gap-1 p-0">
          {({ items }) => (
            <>
              <BasePaginationItem>
                <BasePaginationPrevious aria-label={copy.previous} className={STEP}>
                  <Icon name="caret-back" />
                </BasePaginationPrevious>
              </BasePaginationItem>
              {showCompact && (
                <BasePaginationItem
                  className={cn(
                    'px-2 text-data leading-body whitespace-nowrap tabular-nums',
                    auto && ONLY.compact,
                  )}
                >
                  {copy.position(fmt(current), fmt(pageCount))}
                </BasePaginationItem>
              )}
              {showNumbers &&
                items.map((item) => (
                  <BasePaginationItem key={item} className={cn(auto && ONLY.numbers)}>
                    {typeof item === 'number' ? (
                      <BasePaginationLink
                        page={item}
                        aria-label={copy.page(fmt(item))}
                        className={PAGE}
                      >
                        {fmt(item)}
                      </BasePaginationLink>
                    ) : (
                      <BasePaginationEllipsis
                        data-slot="pagination-ellipsis"
                        className="inline-flex min-w-6 justify-center text-text-muted"
                      />
                    )}
                  </BasePaginationItem>
                ))}
              <BasePaginationItem>
                <BasePaginationNext aria-label={copy.next} className={STEP}>
                  <Icon name="caret-forward" />
                </BasePaginationNext>
              </BasePaginationItem>
            </>
          )}
        </BasePaginationList>
      </BasePagination>
      {pageSizes !== undefined && onPageSizeChange !== undefined && (
        <Select
          label={copy.pageSize}
          // 76 px in compact: a narrower inline padding leaves room for «100» beside the chevron.
          className="w-(--shifa-size-control-select-narrow) in-data-[density=compact]:[&_[role=combobox]]:px-2"
          items={pageSizes.map((size) => ({ value: String(size), label: fmt(size) }))}
          value={String(pageSize)}
          onValueChange={(value) => {
            if (value === null) return;
            onPageSizeChange(Number(value));
            onPageChange(1);
          }}
        />
      )}
    </div>
  );
}
