// Data table at narrow widths (slice 0.4-12, OD-66; sheet "Before Phase A · 0.4-12 and 0.4-13",
// approved 2026-11-23): a header wider than its column is cut on one line with an ellipsis and
// shows its full text in a tooltip, after 500 ms on hover and at once on keyboard focus. A header
// that fits has no tooltip. The column's accessible name stays the full header text; sorting is
// unchanged.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { arrows, renderDir } from '../../test/support/index.ts';
import { DataTable, type DataTableColumn, type DataTableSort } from './data-table.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const LONG = 'تاريخ آخر زيارة للعيادة مع الطبيب المعالج';

interface Patient {
  id: string;
  name: string;
  visit: string;
}

const PATIENTS: Patient[] = people(4, { seed: 41 }).map((p, i) => ({
  id: p.id,
  name: p.name,
  visit: `${String(10 + i)}/11/2026`,
}));

const COLUMNS: DataTableColumn<Patient>[] = [
  { id: 'name', header: 'الاسم', value: (p) => p.name, width: 'lg', sortable: true },
  { id: 'visit', header: LONG, value: (p) => p.visit, width: 'sm', sortable: true },
];

function Patients({ width }: { width: number }) {
  const [sort, setSort] = useState<DataTableSort | null>(null);
  return (
    <div style={{ width }}>
      <DataTable
        aria-label="قائمة المرضى"
        columns={COLUMNS}
        rows={PATIENTS}
        getRowId={(p) => p.id}
        sort={sort}
        onSortChange={setSort}
      />
    </div>
  );
}

const headers = () => [...document.querySelectorAll<HTMLElement>('[role="columnheader"]')];
const header = (text: string): HTMLElement => {
  const found = headers().find((h) => h.textContent.includes(text));
  if (found === undefined) throw new Error(`no header ${text}`);
  return found;
};
/** The element that holds the header's text on one line. */
const labelOf = (h: HTMLElement): HTMLElement => {
  const el = h.querySelector<HTMLElement>('[data-slot="header-label"]');
  if (el === null) throw new Error('no header label');
  return el;
};
const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"][data-open]');
const poll = (fn: () => unknown, message: string, timeout = 1000) =>
  expect.poll(fn, { timeout, message });

describe.each(DIRS)('Data table headers at narrow widths in %s', (dir) => {
  it('a header wider than its column is cut on one line, its name the full text', async () => {
    const screen = await renderDir(<Patients width={480} />, { dir });
    const h = header(LONG);
    const label = labelOf(h);
    expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    const style = getComputedStyle(label);
    expect(style.textOverflow).toBe('ellipsis');
    expect(style.whiteSpace).toBe('nowrap');
    // One line: the label is no taller than one line of its text.
    expect(label.getBoundingClientRect().height).toBeLessThan(
      Number.parseFloat(style.lineHeight) * 1.5,
    );
    expect(screen.getByRole('columnheader', { name: LONG }).element()).toBe(h);
    await screen.unmount();
  });

  it('the cut header shows its full text in a tooltip after the hover delay', async () => {
    const screen = await renderDir(<Patients width={480} />, { dir });
    await userEvent.hover(labelOf(header(LONG)));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(tooltip()).toBeNull();
    await poll(() => tooltip()?.textContent, 'open after 500 ms', 1500).toBe(LONG);
    await userEvent.unhover(labelOf(header(LONG)));
    await poll(tooltip, 'closed when the pointer leaves').toBeNull();
    await screen.unmount();
  });

  it('the cut header shows its tooltip at once on keyboard focus', async () => {
    const screen = await renderDir(<Patients width={480} />, { dir });
    const { forward } = arrows(dir);
    await userEvent.tab();
    await poll(() => document.activeElement, 'the first header').toBe(header('الاسم'));
    await userEvent.keyboard(`{${forward}}`);
    await poll(() => document.activeElement, 'the long header').toBe(header(LONG));
    await poll(() => tooltip()?.textContent, 'open on focus', 300).toBe(LONG);
    await screen.unmount();
  });

  it('a header that fits has no tooltip, on hover or on focus', async () => {
    const screen = await renderDir(<Patients width={480} />, { dir });
    const label = labelOf(header('الاسم'));
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    await userEvent.hover(label);
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(tooltip()).toBeNull();
    await userEvent.tab();
    await poll(() => document.activeElement, 'the first header').toBe(header('الاسم'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(tooltip()).toBeNull();
    await screen.unmount();
  });

  it('once the column is wide enough, the tooltip goes', async () => {
    const screen = await renderDir(<Patients width={480} />, { dir });
    await screen.rerender(<Patients width={1600} />);
    const label = labelOf(header(LONG));
    await poll(() => label.scrollWidth <= label.clientWidth, 'the header fits').toBe(true);
    await userEvent.hover(label);
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(tooltip()).toBeNull();
    await screen.unmount();
  });

  it('sorts by click and by Enter as before, aria-sort on the header', async () => {
    const screen = await renderDir(<Patients width={480} />, { dir });
    const h = header(LONG);
    expect(h.getAttribute('aria-sort')).toBe('none');
    await userEvent.click(labelOf(h));
    await poll(() => header(LONG).getAttribute('aria-sort'), 'sorted by click').toBe('ascending');
    header(LONG).focus();
    await userEvent.keyboard('{Enter}');
    await poll(() => header(LONG).getAttribute('aria-sort'), 'sorted by Enter').toBe('descending');
    await screen.unmount();
  });
});
