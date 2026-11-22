// Pagination (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07", OD-64): previous at the logical start and
// next at the end with arrows that mirror in RTL, page numbers with ellipses (the current one
// filled green, aria-current="page"), an optional page-size select (25, 50, 100) and a «عرض 51–75
// من 312» line in Western digits with grouping (OD-20, OD-61). The compact form says «الصفحة 3 من
// 13». Pages and the range come from UI SDK's Pagination; it is controlled and fetches nothing.
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
  /** numbers (default): page numbers with ellipses; compact: «الصفحة 3 من 13» between the arrows. */
  form?: 'numbers' | 'compact';
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
  form = 'numbers',
  hideSummary = false,
  label = 'ترقيم الصفحات',
  className,
}: PaginationProps) {
  const dir = useDirection();
  const number = new Intl.NumberFormat(NUMBER_LOCALE[dir], { useGrouping: true });
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(totalItems, current * pageSize);
  const fmt = (n: number) => number.format(n);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 font-ui text-text-default',
        className,
      )}
    >
      {!hideSummary && (
        <span className="text-data leading-body text-text-muted tabular-nums">
          {`عرض ${fmt(first)}–${fmt(last)} من ${fmt(totalItems)}`}
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
                <BasePaginationPrevious aria-label="الصفحة السابقة" className={STEP}>
                  <Icon name="caret-back" />
                </BasePaginationPrevious>
              </BasePaginationItem>
              {form === 'compact' ? (
                <BasePaginationItem className="px-2 text-data leading-body tabular-nums">
                  {`الصفحة ${fmt(current)} من ${fmt(pageCount)}`}
                </BasePaginationItem>
              ) : (
                items.map((item) => (
                  <BasePaginationItem key={item}>
                    {typeof item === 'number' ? (
                      <BasePaginationLink
                        page={item}
                        aria-label={`الصفحة ${fmt(item)}`}
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
                ))
              )}
              <BasePaginationItem>
                <BasePaginationNext aria-label="الصفحة التالية" className={STEP}>
                  <Icon name="caret-forward" />
                </BasePaginationNext>
              </BasePaginationItem>
            </>
          )}
        </BasePaginationList>
      </BasePagination>
      {pageSizes !== undefined && onPageSizeChange !== undefined && (
        <Select
          label="صفوف في الصفحة"
          className="w-(--shifa-size-control-lg)"
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
