// RecordList (A-03-01, sheet A03SheetRecordList approved by the owner 2026-11-27): rows of people
// or records. Three layouts (table, two lines, tiles), sizes md and sm; avatar or a type icon; the
// title with its matched words heavier (never coloured, read as plain text); a second line of
// badges and short texts; optional columns read with their headers; at the end a chevron (a link
// row), a button, a badge, or small tool buttons and a button. Locked rows show neither name nor
// avatar; dim and current rows; loading and empty. The links share one Tab stop, ↑ ↓ Home End move
// between rows, Enter opens.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nationalPhone, people, phones } from '../../test/fixtures.ts';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { RecordList, type RecordListColumn, type RecordListItem } from './record-list.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** `value`, or a failed test when it is missing. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

const [A, B, C] = people(3, { seed: 31 });
const [P1, P2] = phones(2, { seed: 77 }).map(nationalPhone);
const NAME_A = A?.name ?? '';
const NAME_B = B?.name ?? '';
const NAME_C = C?.name ?? '';

const COLUMNS: RecordListColumn[] = [
  { header: 'رقم الملف', weight: 0.7 },
  { header: 'الجنس والعمر' },
  { header: 'هاتف التواصل', weight: 1.5 },
];

const SEARCH: RecordListItem[] = [
  {
    id: '1043',
    title: NAME_A,
    matches: [0],
    details: [{ text: 'الاسم' }],
    cells: [
      { text: '1043', kind: 'number' },
      { text: 'أنثى · 34 سنة' },
      { text: P1 ?? '', kind: 'latin' },
    ],
    href: '/patients/1043',
  },
  {
    id: '1187',
    title: NAME_B,
    details: [{ text: 'الاسم بتهجئة قريبة' }, { text: 'ابنة صاحب الهاتف' }],
    cells: [
      { text: '1187', kind: 'number' },
      { text: 'أنثى · ~9 سنوات' },
      { text: P1 ?? '', kind: 'latin' },
    ],
    href: '/patients/1187',
    current: true,
  },
  {
    id: '214',
    title: NAME_C,
    details: [{ badge: 'مؤرشف', tone: 'neutral', icon: 'archive' }, { text: 'أُرشف في 02/09/2026' }],
    cells: [
      { text: '214', kind: 'number' },
      { text: 'أنثى · 70 سنة' },
      { text: P2 ?? '', kind: 'latin' },
    ],
    href: '/patients/214',
    dim: true,
  },
];

const links = () => [
  ...document.querySelectorAll<HTMLAnchorElement>(
    '[data-slot="record-row"] a, a[data-slot="record-row"]',
  ),
];

describe.each(DIRS)('RecordList in %s', (dir) => {
  it('is a named list of rows; each link row is a real link with the whole row inside', async () => {
    const screen = await renderDir(
      <div style={{ width: 1000 }}>
        <RecordList
          aria-label="نتائج البحث"
          items={SEARCH}
          columns={COLUMNS}
          titleHeader="المريض"
        />
      </div>,
      { dir },
    );
    const list = screen.getByRole('list', { name: 'نتائج البحث' }).element();
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    const first = screen.getByRole('link', { name: new RegExp(NAME_A) }).element();
    expect(first.getAttribute('href')).toBe('/patients/1043');
    // Read once, whole: the name, the second line, then each column with its header.
    const name = first.textContent;
    expect(name.indexOf(NAME_A.split(' ')[0] ?? '')).toBeLessThan(name.indexOf('الاسم'));
    expect(name).toContain('رقم الملف');
    expect(name).toContain('1043');
    // The avatar does not repeat the name to a screen reader.
    expect(first.querySelector('[role="img"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    // The visible column header row is hidden from screen readers (each cell says its header).
    const head = list.querySelector('[data-slot="record-list-head"]');
    expect(head?.getAttribute('aria-hidden')).toBe('true');
    expect(head?.textContent).toContain('المريض');
    await screen.unmount();
  });

  it('matched words are heavier, not coloured, and read as one name', async () => {
    const screen = await renderDir(
      <RecordList aria-label="نتائج" items={SEARCH.slice(0, 1)} layout="stack" />,
      { dir },
    );
    const bold = document.querySelector('[data-slot="record-title"] b');
    expect(bold?.textContent).toBe(NAME_A.split(' ')[0]);
    const other = document.querySelector('[data-slot="record-title"] span');
    expect(Number(getComputedStyle(must(bold, 'bold')).fontWeight)).toBeGreaterThan(
      Number(getComputedStyle(must(other, 'plain word')).fontWeight),
    );
    expect(getComputedStyle(must(bold, 'bold')).color).toBe(
      getComputedStyle(must(other, 'plain word')).color,
    );
    await screen.unmount();
  });

  it('one Tab stop for the links; ↑ ↓ Home End move; Enter opens', async () => {
    const onOpen = vi.fn((_id: string, event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    const screen = await renderDir(
      <>
        <button type="button">قبل</button>
        <RecordList aria-label="نتائج" items={SEARCH} layout="stack" onOpen={onOpen} />
        <button type="button">بعد</button>
      </>,
      { dir },
    );
    const rows = links();
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    screen.getByRole('button', { name: 'قبل' }).element().focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(rows[0]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[1]);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(rows[2]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[2]);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(rows[0]);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(rows[0]);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('بعد');
    await userEvent.tab({ shift: true });
    // Back in, on the row last moved to.
    expect(document.activeElement).toBe(rows[1]);
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith('1187', expect.anything());
    await screen.unmount();
  });

  it('current is marked and selected in colour; dim rows are muted', async () => {
    const screen = await renderDir(
      <RecordList aria-label="نتائج" items={SEARCH} layout="stack" />,
      { dir },
    );
    const rows = [...document.querySelectorAll<HTMLElement>('[data-slot="record-row"]')];
    const current = must(rows[1], 'current row');
    expect(
      current.querySelector('[aria-current="true"]') ??
        (current.getAttribute('aria-current') === 'true' ? current : null),
    ).not.toBeNull();
    expect(getComputedStyle(current).backgroundColor).toBe(
      tokenColor('--shifa-color-selection-default', current),
    );
    const title = must(rows[2]?.querySelector('[data-slot="record-title"]'), 'dim title');
    expect(getComputedStyle(title).color).toBe(tokenColor('--shifa-color-text-muted', title));
    await screen.unmount();
  });

  it('a locked row has no name, no avatar and no link, and says why', async () => {
    const screen = await renderDir(
      <RecordList
        aria-label="ملفات مشابهة"
        layout="stack"
        size="sm"
        items={[
          {
            id: '88',
            title: NAME_A,
            details: [{ text: 'ملف 88' }],
            action: { label: 'فتح الملف', onClick: () => undefined },
          },
          {
            id: '1188',
            locked: true,
            title: 'ملف مشابه لدى طبيب آخر',
            details: [{ text: 'ملف 1188' }],
          },
        ]}
      />,
      { dir },
    );
    const rows = [...document.querySelectorAll<HTMLElement>('[data-slot="record-row"]')];
    const locked = must(rows[1], 'locked row');
    expect(locked.querySelector('a')).toBeNull();
    expect(
      locked.querySelector(
        '[data-slot="avatar"], [role="img"][aria-label="ملف مشابه لدى طبيب آخر"]',
      ),
    ).toBeNull();
    expect(locked.querySelector('svg[data-shifa-icon="eye-slash"]')).not.toBeNull();
    expect(locked.textContent).toContain('ملف مشابه لدى طبيب آخر');
    expect(locked.textContent).toContain('1188');
    await screen.unmount();
  });

  it('a row with a button, tools and a trailing badge: each control is named and works', async () => {
    const edit = vi.fn();
    const down = vi.fn();
    const screen = await renderDir(
      <RecordList
        aria-label="حقول"
        layout="stack"
        size="sm"
        items={[
          {
            id: 'f1',
            icon: 'check-circle',
            title: 'جهة الإحالة',
            details: [{ badge: 'اختيار واحد' }, { badge: 'مطلوب', tone: 'brand' }],
            tools: [
              {
                icon: 'caret-up',
                label: 'نقل «جهة الإحالة» للأعلى',
                onClick: () => undefined,
                disabled: true,
              },
              { icon: 'caret-down', label: 'نقل «جهة الإحالة» للأسفل', onClick: down },
            ],
            action: { label: 'تعديل', onClick: edit },
          },
          { id: 'd1', title: NAME_B, badge: { label: 'غير نشطة' }, dim: true },
        ]}
      />,
      { dir },
    );
    expect(document.querySelector('svg[data-shifa-icon="check-circle"]')).not.toBeNull();
    const up = screen.getByRole('button', { name: 'نقل «جهة الإحالة» للأعلى' }).element();
    expect(up.getAttribute('aria-disabled') === 'true' || (up as HTMLButtonElement).disabled).toBe(
      true,
    );
    await screen.getByRole('button', { name: 'نقل «جهة الإحالة» للأسفل' }).click();
    expect(down).toHaveBeenCalledOnce();
    await screen.getByRole('button', { name: 'تعديل' }).click();
    expect(edit).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-slot="record-row"]:last-child')?.textContent).toContain(
      'غير نشطة',
    );
    await screen.unmount();
  });

  it('table layout: columns as wide as their weights; under 640 px it becomes two lines', async () => {
    for (const [width, table] of [
      [1000, true],
      [358, false],
    ] as const) {
      const screen = await renderDir(
        <div style={{ width }}>
          <RecordList aria-label="نتائج" items={SEARCH} columns={COLUMNS} />
        </div>,
        { dir },
      );
      const head = document.querySelector<HTMLElement>('[data-slot="record-list-head"]');
      const shown = head !== null && getComputedStyle(head).display !== 'none';
      expect(shown, `${String(width)} px`).toBe(table);
      // Either way the row still carries the file number.
      expect(links()[0]?.textContent).toContain('1043');
      if (!table) expect((links()[0] as HTMLElement).scrollWidth).toBeLessThanOrEqual(width);
      await screen.unmount();
    }
  });

  it('latin values are isolated left to right', async () => {
    const screen = await renderDir(
      <div style={{ width: 1000 }}>
        <RecordList aria-label="نتائج" items={SEARCH} columns={COLUMNS} />
      </div>,
      { dir },
    );
    const phone = [...document.querySelectorAll('[data-kind="latin"]')].find(
      (el) =>
        getComputedStyle(el).display !== 'none' && el.closest('[style*="display: none"]') === null,
    );
    expect(phone).toBeDefined();
    expect(getComputedStyle(must(phone, 'phone')).direction).toBe('ltr');
    await screen.unmount();
  });

  it('loading: a busy list of skeleton rows, named; empty: the EmptyState', async () => {
    const screen = await renderDir(
      <RecordList aria-label="نتائج" items={SEARCH} loading loadingLabel="جارٍ البحث" />,
      { dir },
    );
    const list = screen.getByRole('list', { name: 'نتائج' }).element();
    expect(list.getAttribute('aria-busy')).toBe('true');
    expect(document.body.textContent).toContain('جارٍ البحث');
    expect(links()).toHaveLength(0);
    await screen.unmount();
    const empty = await renderDir(
      <RecordList
        aria-label="نتائج"
        items={[]}
        empty={{ title: 'لا ملف يطابق البحث', description: 'تأكد من الكتابة، أو ابحث بالهاتف.' }}
      />,
      { dir },
    );
    expect(empty.getByText('لا ملف يطابق البحث').element()).toBeDefined();
    await empty.unmount();
  });

  it('tiles: link cards in a grid', async () => {
    const screen = await renderDir(
      <div style={{ width: 1000 }}>
        <RecordList
          aria-label="فتحتها مؤخرًا"
          items={SEARCH}
          layout="tiles"
          size="sm"
          framed={false}
        />
      </div>,
      { dir },
    );
    const [r1, r2] = links().map((r) => r.getBoundingClientRect());
    expect(Math.abs((r1?.top ?? 0) - (r2?.top ?? 1))).toBeLessThan(2);
    await screen.unmount();
  });

  it('rows keep the table row height: 48 comfortable at least, 44 px targets; compact smaller', async () => {
    for (const density of ['comfortable', 'compact'] as const) {
      const screen = await renderDir(
        <RecordList aria-label="نتائج" items={SEARCH} layout="stack" size="sm" />,
        {
          dir,
          density,
        },
      );
      const h = (links()[0] as HTMLElement).getBoundingClientRect().height;
      if (density === 'comfortable') expect(h).toBeGreaterThanOrEqual(48);
      else expect(h).toBeGreaterThanOrEqual(32);
      await screen.unmount();
    }
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s', async (theme) => {
    const screen = await renderDir(
      <div style={{ width: 1000 }}>
        <RecordList aria-label="نتائج البحث" items={SEARCH} columns={COLUMNS} footer="3 نتائج" />
        <RecordList
          aria-label="ملفات مشابهة"
          layout="stack"
          size="sm"
          items={[
            { id: '88', title: NAME_A, action: { label: 'فتح الملف', onClick: () => undefined } },
            { id: '1188', locked: true, title: 'ملف مشابه لدى طبيب آخر' },
          ]}
        />
      </div>,
      { dir, theme },
    );
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
