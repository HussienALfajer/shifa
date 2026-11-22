// Data table virtualisation (slice 0.4-07, spec 0.4 criterion 8): 5,000 synthetic rows render with
// a bounded number of DOM rows, the grid keeps the full size for screen readers (aria-rowcount with
// the header, aria-rowindex on each row), and keyboard focus survives scrolling out and back. No
// timing assertion in CI.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { DataTable, type DataTableColumn } from './data-table.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const NAMES = people(20, { seed: 53 }).map((p) => p.name);

interface Invoice {
  id: string;
  no: string;
  name: string;
  amount: number;
}

const INVOICES: Invoice[] = Array.from({ length: 5000 }, (_, i) => ({
  id: String(i + 1),
  no: `INV-2026-${String(i + 1).padStart(4, '0')}`,
  name: NAMES[i % NAMES.length] ?? '',
  amount: ((i * 7919) % 1000) * 1000,
}));

const COLUMNS: DataTableColumn<Invoice>[] = [
  { id: 'no', header: 'رقم الفاتورة', value: (r) => r.no, kind: 'latin' },
  { id: 'name', header: 'المريض', value: (r) => r.name },
  { id: 'amount', header: 'المبلغ', value: (r) => r.amount, kind: 'number' },
];

const rows = () => [...document.querySelectorAll('[role="grid"] [role="row"]')];
const scroller = () => document.querySelector<HTMLElement>('[data-slot="data-table-scroll"]');
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 2000, message });

describe.each(DIRS)('Data table with 5,000 rows in %s', (dir) => {
  it('renders fewer than 100 DOM rows and keeps the full size', async () => {
    const screen = await renderDir(
      <DataTable aria-label="الفواتير" columns={COLUMNS} rows={INVOICES} getRowId={(r) => r.id} />,
      { dir },
    );
    await poll(() => rows().length > 1, 'rows drawn').toBe(true);
    expect(rows().length).toBeLessThan(100);
    const grid = screen.getByRole('grid', { name: 'الفواتير' }).element();
    expect(grid.getAttribute('aria-rowcount')).toBe('5001');
    const indexes = rows().map((r) => Number(r.getAttribute('aria-rowindex')));
    expect(indexes[0]).toBe(1);
    expect(indexes[1]).toBe(2);
    await screen.unmount();
  });

  it('scrolling far draws the rows there, still bounded', async () => {
    const screen = await renderDir(
      <DataTable aria-label="الفواتير" columns={COLUMNS} rows={INVOICES} getRowId={(r) => r.id} />,
      { dir },
    );
    const box = scroller();
    if (box === null) throw new Error('no scroll box');
    box.scrollTop = box.scrollHeight / 2;
    await poll(
      () => rows().some((r) => Number(r.getAttribute('aria-rowindex')) > 2000),
      'middle rows drawn',
    ).toBe(true);
    expect(rows().length).toBeLessThan(100);
    await screen.unmount();
  });

  it('Ctrl+End reaches the last row of all 5,000', async () => {
    const screen = await renderDir(
      <DataTable aria-label="الفواتير" columns={COLUMNS} rows={INVOICES} getRowId={(r) => r.id} />,
      { dir },
    );
    await userEvent.tab();
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await poll(
      () => document.activeElement?.closest('[role="row"]')?.getAttribute('aria-rowindex'),
      'last row focused',
    ).toBe('5001');
    await screen.unmount();
  });

  it('focus survives scrolling out and back', async () => {
    const screen = await renderDir(
      <DataTable aria-label="الفواتير" columns={COLUMNS} rows={INVOICES} getRowId={(r) => r.id} />,
      { dir },
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const focused = document.activeElement;
    const index = focused?.closest('[role="row"]')?.getAttribute('aria-rowindex');
    expect(index).toBe('3');
    const box = scroller();
    if (box === null) throw new Error('no scroll box');
    box.scrollTop = box.scrollHeight - box.clientHeight;
    await poll(
      () => rows().some((r) => Number(r.getAttribute('aria-rowindex')) > 4900),
      'scrolled to the end',
    ).toBe(true);
    box.scrollTop = 0;
    await poll(
      () => document.activeElement?.closest('[role="row"]')?.getAttribute('aria-rowindex'),
      'focus still on row 3',
    ).toBe('3');
    await userEvent.keyboard('{ArrowDown}');
    await poll(
      () => document.activeElement?.closest('[role="row"]')?.getAttribute('aria-rowindex'),
      'and moves on',
    ).toBe('4');
    await screen.unmount();
  });
});
