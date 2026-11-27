// Data table wrapping column, from the review of the A-02 components: hiding the wrapping column
// (or showing it again) measures the rows afresh, so they still touch; PageDown in a table of tall
// rows moves by the rows that fit; a one-line cell cut in a narrow box ends in an ellipsis.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { DataTable, type DataTableColumn } from './data-table.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const NAMES = people(3, { seed: 61 }).map((p) => p.name);
const LONG =
  'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية، بينما يظهر الموعد في شاشة السكرتير ولا يظهر في تقويم الطبيب. نريد أن نرى ما يراه المالك قبل أن نطلب منه تصوير الشاشة.';

interface Grant {
  id: string;
  who: string;
  reason: string;
  start: string;
}

const ROWS: Grant[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  who: NAMES[i % 3] ?? '',
  reason: LONG,
  start: '24/11/2026 09:10',
}));
const COLUMNS: DataTableColumn<Grant>[] = [
  { id: 'who', header: 'من', value: (g) => g.who, width: 'md' },
  { id: 'reason', header: 'السبب', value: (g) => g.reason, wrap: true },
  { id: 'start', header: 'البداية', value: (g) => g.start },
];

const bodyRows = () => [...document.querySelectorAll('[role="grid"] [role="row"]')].slice(1);
const touching = () =>
  bodyRows().every((row, i, all) => {
    const next = all[i + 1];
    return (
      next === undefined ||
      Math.abs(next.getBoundingClientRect().top - row.getBoundingClientRect().bottom) < 1
    );
  });
const rowIndex = () =>
  Number(document.activeElement?.closest('[role="row"]')?.getAttribute('aria-rowindex'));

function Log() {
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <div style={{ width: 700 }}>
      <Button
        onClick={() => {
          setHidden(hidden.length > 0 ? [] : ['reason']);
        }}
      >
        تبديل السبب
      </Button>
      <DataTable
        aria-label="سجل"
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(g) => g.id}
        hiddenColumns={hidden}
      />
    </div>
  );
}

describe.each(DIRS)('Data table wrapping column review in %s', (dir) => {
  it('hiding the wrapping column and showing it again keeps the rows touching', async () => {
    const screen = await renderDir(<Log />, { dir });
    await expect.poll(() => bodyRows().length > 2 && touching()).toBe(true);
    const tall = bodyRows()[0]?.getBoundingClientRect().height ?? 0;
    expect(tall).toBeGreaterThan(72);
    await screen.getByRole('button', { name: 'تبديل السبب' }).click();
    await expect
      .poll(() => Math.round(bodyRows()[0]?.getBoundingClientRect().height ?? 0))
      .toBe(48);
    await expect.poll(touching, { message: 'rows touch with the column hidden' }).toBe(true);
    await screen.getByRole('button', { name: 'تبديل السبب' }).click();
    await expect.poll(() => (bodyRows()[0]?.getBoundingClientRect().height ?? 0) > 72).toBe(true);
    await expect.poll(touching, { message: 'rows touch with the column back' }).toBe(true);
    await screen.unmount();
  });

  it('PageDown moves by the tall rows that fit, never past unseen ones', async () => {
    const screen = await renderDir(<Log />, { dir });
    await expect.poll(() => bodyRows().length > 2 && touching()).toBe(true);
    const scroll = document.querySelector<HTMLElement>('[data-slot="data-table-scroll"]');
    const head = document.querySelector('[role="row"]')?.getBoundingClientRect().height ?? 0;
    const tall = bodyRows()[0]?.getBoundingClientRect().height ?? 1;
    const fit = Math.floor(((scroll?.clientHeight ?? 0) - head) / tall);
    // The toggle button first, then the grid's one Tab stop.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{PageDown}');
    expect(rowIndex() - 2).toBeGreaterThanOrEqual(1);
    expect(rowIndex() - 2).toBeLessThanOrEqual(Math.max(1, fit));
    await screen.unmount();
  });

  it('a one-line cell cut in a narrow box ends in an ellipsis', async () => {
    const screen = await renderDir(
      <div style={{ width: 420 }}>
        <DataTable
          aria-label="سجل"
          columns={COLUMNS}
          rows={ROWS.slice(0, 2)}
          getRowId={(g) => g.id}
        />
      </div>,
      { dir },
    );
    await expect.poll(() => bodyRows().length).toBe(2);
    const start = bodyRows()[0]?.querySelectorAll('[role="gridcell"]')[2];
    const text = start?.querySelector('.truncate');
    if (!(text instanceof HTMLElement)) throw new Error('no one-line text box');
    expect(getComputedStyle(text).textOverflow).toBe('ellipsis');
    await screen.unmount();
  });
});
