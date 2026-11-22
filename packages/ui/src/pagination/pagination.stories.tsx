// Pagination stories, as on the approved sheet (owner, 2026-11-22, OD-64). Every story renders in
// the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import { Pagination } from './pagination.tsx';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  parameters: {
    docs: {
      description: {
        component:
          'Page controls under a list: previous at the logical start and next at the end (arrows mirror in RTL), page numbers with ellipses, the current page green and announced, an optional page-size select (25, 50, 100; a change goes back to page 1) and «عرض 51–75 من 312» in Western digits. The compact form says «الصفحة 3 من 13». Controlled: the caller loads the page.',
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
