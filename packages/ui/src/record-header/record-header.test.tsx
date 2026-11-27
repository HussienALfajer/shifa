// RecordHeader (A-03-01, sheet A03SheetRecordHeader approved by the owner 2026-11-27): who a record
// is, at the top of its page. A region named for the record; avatar, title (h1 on a page, h2 in a
// panel), the record number in a gold tag read «ملف 1043», badges and one with a Tooltip (the «~»
// stays visible), facts under a rule, a meta line, actions or «للقراءة فقط»; muted when archived or
// merged; compact in a panel with a larger number; loading.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nationalPhone, people, phones } from '../../test/fixtures.ts';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../menu/menu.tsx';
import { RecordHeader, type RecordHeaderFact } from './record-header.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** `value`, or a failed test when it is missing. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

const [PERSON, EDITOR] = people(2, { seed: 41 }).map((p) => p.name);
const NAME = PERSON ?? '';
const [PHONE] = phones(1, { seed: 90 }).map(nationalPhone);
const FACTS: RecordHeaderFact[] = [
  { label: 'هاتف التواصل', value: PHONE ?? '', kind: 'latin' },
  { label: 'رقم الملف السابق', value: 'A-1180', kind: 'latin' },
  { label: 'سُجّل في', value: 'فرع الشهباء · 12/03/2026' },
];

const actions = (
  <>
    <Button startIcon="pencil">تعديل</Button>
    <Menu>
      <MenuTrigger>المزيد</MenuTrigger>
      <MenuContent>
        <MenuItem value="merge">دمج مع ملف آخر</MenuItem>
      </MenuContent>
    </Menu>
  </>
);

describe.each(DIRS)('RecordHeader in %s', (dir) => {
  it('a region named for the record: h1, the gold number, badges, facts, meta, actions', async () => {
    const screen = await renderDir(
      <RecordHeader
        aria-label="هوية المريض"
        title={NAME}
        idLabel="ملف"
        idValue="1043"
        badges={[{ label: 'أنثى' }, { label: '34 سنة', icon: 'calendar' }]}
        facts={FACTS}
        meta={`آخر تعديل 20/11/2026 بيد ${EDITOR ?? ''}`}
        actions={actions}
      />,
      { dir },
    );
    const region = screen.getByRole('region', { name: 'هوية المريض' }).element();
    expect(region.querySelector('h1')?.textContent).toBe(NAME);
    const id = must(region.querySelector<HTMLElement>('[data-slot="record-id"]'), 'number tag');
    expect(id.textContent.replace(/\s+/g, ' ').trim()).toBe('ملف 1043');
    expect(getComputedStyle(id).borderTopColor).toBe(tokenColor('--shifa-color-brand-accent', id));
    expect(getComputedStyle(id).backgroundColor).toBe(
      tokenColor('--shifa-color-brand-accent-soft', id),
    );
    expect(getComputedStyle(id).color).toBe(tokenColor('--shifa-color-text-default', id));
    const dl = region.querySelector('dl');
    expect(dl?.querySelectorAll('dt')).toHaveLength(3);
    const phone = [...(dl?.querySelectorAll('dd') ?? [])][0] as Element;
    expect(getComputedStyle(phone).direction).toBe('ltr');
    expect(region.textContent).toContain('آخر تعديل');
    expect(screen.getByRole('button', { name: 'تعديل' }).element()).toBeDefined();
    expect(region.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(NAME);
    await screen.unmount();
  });

  it('a badge with a tooltip: a focusable trigger that opens it at once, the «~» visible', async () => {
    const screen = await renderDir(
      <RecordHeader
        title={NAME}
        idValue="1043"
        badges={[
          { label: 'أنثى' },
          { label: '~40 سنة', tip: 'عمر تقريبي: سُجّل العمر دون تاريخ الميلاد.' },
        ]}
      />,
      { dir },
    );
    expect(document.body.textContent).toContain('~40 سنة');
    await userEvent.tab();
    expect(document.activeElement?.textContent).toContain('~40 سنة');
    await expect
      .poll(() => document.querySelector('[role="tooltip"]')?.textContent ?? '')
      .toContain('عمر تقريبي');
    await screen.unmount();
  });

  it('muted (archived or merged): no actions, «للقراءة فقط» shown, the raised surface', async () => {
    const screen = await renderDir(
      <RecordHeader
        aria-label="هوية المريض"
        title={NAME}
        idValue="1043"
        muted
        badges={[{ label: 'مؤرشف', icon: 'archive' }]}
        readOnlyNote="للقراءة فقط"
        actions={actions}
      />,
      { dir },
    );
    const region = screen.getByRole('region', { name: 'هوية المريض' }).element() as HTMLElement;
    expect(region.querySelector('button:not([data-slot="record-badge-tip"])')).toBeNull();
    expect(region.textContent).toContain('للقراءة فقط');
    expect(getComputedStyle(region).backgroundColor).toBe(
      tokenColor('--shifa-color-bg-surface-raised', region),
    );
    await screen.unmount();
  });

  it('compact in a panel: h2, no facts, the number larger', async () => {
    const screen = await renderDir(
      <>
        <RecordHeader aria-label="أ" title={NAME} idValue="1285" facts={FACTS} />
        <RecordHeader aria-label="ب" title={NAME} idValue="1285" facts={FACTS} compact />
      </>,
      { dir },
    );
    const big = screen.getByRole('region', { name: 'أ' }).element();
    const small = screen.getByRole('region', { name: 'ب' }).element();
    expect(small.querySelector('h2')?.textContent).toBe(NAME);
    expect(small.querySelector('h1')).toBeNull();
    expect(small.querySelector('dl')).toBeNull();
    const size = (el: Element) =>
      Number.parseFloat(
        getComputedStyle(must(el.querySelector('[data-slot="record-id"] b'), 'number')).fontSize,
      );
    expect(size(small)).toBeGreaterThan(size(big));
    await screen.unmount();
  });

  it('loading: busy with a named skeleton, no title', async () => {
    const screen = await renderDir(
      <RecordHeader aria-label="هوية المريض" title={NAME} loading loadingLabel="جارٍ فتح الملف" />,
      { dir },
    );
    const region = screen.getByRole('region', { name: 'هوية المريض' }).element();
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.textContent).toContain('جارٍ فتح الملف');
    expect(region.querySelector('h1')).toBeNull();
    await screen.unmount();
  });

  it('at 358 px the actions go under the title and the facts are one column', async () => {
    const screen = await renderDir(
      <div style={{ width: 358 }}>
        <RecordHeader title={NAME} idValue="1043" facts={FACTS} actions={actions} />
      </div>,
      { dir },
    );
    const title = document.querySelector('h1')?.getBoundingClientRect();
    const edit = screen.getByRole('button', { name: 'تعديل' }).element().getBoundingClientRect();
    expect(edit.top).toBeGreaterThan(title?.bottom ?? 0);
    const dts = [...document.querySelectorAll('dt')].map((d) => d.getBoundingClientRect().left);
    expect(new Set(dts.map(Math.round)).size).toBe(1);
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s', async (theme) => {
    const screen = await renderDir(
      <RecordHeader
        aria-label="هوية المريض"
        title={NAME}
        idValue="1043"
        badges={[{ label: 'أنثى' }, { label: '~40 سنة', tip: 'عمر تقريبي' }]}
        facts={FACTS}
        meta="آخر تعديل 20/11/2026"
        actions={actions}
      />,
      { dir, theme },
    );
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
