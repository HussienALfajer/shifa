// Pagination stories, as on the approved sheet (owner, 2026-11-22, OD-64). Every story renders in
// the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import { storyStates } from '../../.storybook/story-states.tsx';
import { useDirection } from '../providers/direction-provider.tsx';
import { Pagination, type PaginationCopy } from './pagination.tsx';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  parameters: {
    docs: {
      description: {
        component:
          'Page controls under a list: previous at the logical start and next at the end (arrows mirror in RTL), page numbers with ellipses, the current page green, an optional page-size select (25, 50, 100; a change goes back to page 1) and «عرض 51–75 من 312» in Western digits. The form follows the pagination’s own width: below 430 px the compact form («الصفحة 3 من 13» between the arrows, the summary on a second line), from 430 px the page numbers; `form` forces one. The page-size select is 88 px wide (76 px compact). `copy` takes the words of an English screen. Controlled: the caller loads the page.\n\n**Accessibility.** A `navigation` landmark named by `label` («ترقيم الصفحات» by default; give each pagination on one screen its own). Every step and page number is a native `button` that Tab reaches, pressed by Enter or Space; previous is disabled on the first page. A screen reader hears «الصفحة السابقة», «الصفحة التالية» and «الصفحة 4», and the current page as `aria-current="page"`; the ellipses are hidden. The page-size select is a labelled field («صفوف في الصفحة»).',
      },
    },
  },
  args: { page: 3, pageSize: 25, totalItems: 312, onPageChange: () => undefined },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The matrix draws each story eight times on one page: a landmark needs its own name in each copy
 * (axe landmark-unique). A screen holds one pagination per list and keeps the default name.
 */
function useCopyLabel(): string {
  return `ترقيم الصفحات ${useId()}`;
}

function Fixed({ page }: { page: number }) {
  return (
    <Pagination
      label={useCopyLabel()}
      page={page}
      pageSize={25}
      totalItems={312}
      onPageChange={() => undefined}
    />
  );
}

function Live({ initial, form }: { initial: number; form?: 'numbers' | 'compact' }) {
  const [page, setPage] = useState(initial);
  const [pageSize, setPageSize] = useState(25);
  return (
    <Pagination
      label={useCopyLabel()}
      page={page}
      onPageChange={setPage}
      pageSize={pageSize}
      totalItems={312}
      pageSizes={[25, 50, 100]}
      onPageSizeChange={setPageSize}
      {...(form === undefined ? {} : { form })}
    />
  );
}

/** Page 3 of 13, with the page-size select. */
export const Default: Story = { render: () => <Live initial={3} /> };

/** The first page (previous disabled) and a middle page (ellipses on both sides). */
export const Positions: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Fixed page={1} />
      <Fixed page={7} />
    </div>
  ),
};

/** The compact form, for a phone or a long list. */
export const Compact: Story = { render: () => <Live initial={3} form="compact" /> };

/**
 * The text states. The pagination's own text is the summary and «الصفحة 248 من 494», so these show
 * them long (a clinic's 12,345 invoices: Western digits with grouping inside Arabic); the label
 * names the copy. The compact form: a 256 px column and 200 % zoom are as narrow as a phone, where
 * the page numbers do not fit.
 */
function TextState({ label }: { label: string }) {
  return (
    <Pagination
      label={`${label} ${useId()}`}
      page={248}
      pageSize={25}
      totalItems={12345}
      form="compact"
      onPageChange={() => undefined}
    />
  );
}

/** The words of an English screen, as a caller passes them (criterion 13 of slice 0.4-12). */
const ENGLISH: PaginationCopy = {
  summary: (first, last, total) => `Showing ${first}–${last} of ${total}`,
  position: (page, pageCount) => `Page ${page} of ${pageCount}`,
  page: (page) => `Page ${page}`,
  previous: 'Previous page',
  next: 'Next page',
  pageSize: 'Rows per page',
};

/** At 200 % zoom the English region speaks English, as an English screen would. */
function ZoomState() {
  const english = useDirection() === 'ltr';
  return (
    <Pagination
      label={`${english ? 'Save' : 'حفظ'} ${useId()}`}
      page={248}
      pageSize={25}
      totalItems={12345}
      form="compact"
      onPageChange={() => undefined}
      {...(english ? { copy: ENGLISH } : {})}
    />
  );
}

const states = storyStates((label) => <TextState label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = storyStates(() => <ZoomState />)['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};

/**
 * The form follows the pagination's own width (OD-66): the compact form at 320 and 429 px, the page
 * numbers at 430 and 600 px. Each box is a column of that width; the rows-per-page Select shows «100».
 */
function Widths() {
  const label = useCopyLabel();
  return (
    <div className="flex flex-col gap-4">
      {WIDTHS.map((width) => (
        <div key={width} className="flex flex-col gap-1">
          <span className="text-caption text-text-muted" dir="ltr">{`${String(width)} px`}</span>
          <div
            style={{ width }} // An outline, not a border: it takes no width, so the box is exactly the width it names.
            className="outline-1 outline-dashed outline-border-default"
          >
            <Pagination
              label={`${label} ${String(width)}`}
              page={3}
              pageSize={100}
              totalItems={1300}
              pageSizes={[25, 50, 100]}
              onPageSizeChange={() => undefined}
              onPageChange={() => undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Story fixture: the column widths of the narrow-width check (OD-66). */
const WIDTHS = [320, 429, 430, 600] as const;

/** The compact form below 430 px and the page numbers from it, in four column widths. */
export const NarrowWidths: Story = { render: () => <Widths /> };
