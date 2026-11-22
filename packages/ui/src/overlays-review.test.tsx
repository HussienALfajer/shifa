// Review of slice 0.4-06 (reviewer agent, 2026-11-22): one test per finding fixed, in Arabic RTL.
// B1 the accordion caret reads its own header, not an open drawer around it; N5 the segmented
// control's focus ring is drawn inside its track; N6 Home and End choose, not only focus; N7 one
// Escape closes an empty palette and the first clears typed text; N8 the palette finds an option
// by its second line, with Arabic-Indic digits too.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir, typeArabic } from '../test/support/index.ts';
import { Accordion, AccordionItem } from './accordion/accordion.tsx';
import { CommandPalette } from './command-palette/command-palette.tsx';
import { Drawer, DrawerContent } from './drawer/drawer.tsx';
import { SegmentedControl } from './segmented-control/segmented-control.tsx';

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });

const caretTurn = (name: string) => {
  const header = [...document.querySelectorAll('[data-slot="accordion-trigger"]')].find((el) =>
    el.textContent.includes(name),
  );
  const caret = header?.querySelector('svg');
  if (caret === null || caret === undefined) throw new Error(`no caret for ${name}`);
  return getComputedStyle(caret).rotate;
};

function Sections() {
  return (
    <Accordion defaultValue={['allergies']}>
      <AccordionItem value="allergies" title="الحساسية">
        حساسية من البنسلين
      </AccordionItem>
      <AccordionItem value="visits" title="الزيارات السابقة">
        أربع زيارات
      </AccordionItem>
    </Accordion>
  );
}

describe('0.4-06 review', () => {
  it('B1: a closed section keeps its caret inside an open drawer', async () => {
    const outside = await renderDir(<Sections />);
    const closedTurn = caretTurn('الزيارات السابقة');
    const openTurn = caretTurn('الحساسية');
    expect(openTurn).not.toBe(closedTurn);
    await outside.unmount();

    const inside = await renderDir(
      <Drawer defaultOpen>
        <DrawerContent title="ملخص المريض">
          <Sections />
        </DrawerContent>
      </Drawer>,
    );
    await expect.element(inside.getByRole('dialog')).toBeVisible();
    expect(caretTurn('الزيارات السابقة')).toBe(closedTurn);
    expect(caretTurn('الحساسية')).toBe(openTurn);
    await inside.unmount();
  });

  it('N5 and N6: the focus ring is drawn inward; Home and End choose', async () => {
    const screen = await renderDir(
      <SegmentedControl
        aria-label="عرض التقويم"
        defaultValue="week"
        items={[
          { value: 'day', label: 'اليوم' },
          { value: 'week', label: 'الأسبوع' },
          { value: 'month', label: 'الشهر' },
        ]}
      />,
    );
    const radio = (name: string) => screen.getByRole('radio', { name }).element();
    await userEvent.tab();
    expect(document.activeElement).toBe(radio('الأسبوع'));
    expect(Number.parseFloat(getComputedStyle(radio('الأسبوع')).outlineOffset)).toBeLessThan(0);
    await userEvent.keyboard('{Home}');
    await poll(() => radio('اليوم').getAttribute('aria-checked'), 'Home chooses').toBe('true');
    await userEvent.keyboard('{End}');
    await poll(() => radio('الشهر').getAttribute('aria-checked'), 'End chooses').toBe('true');
    expect(radio('اليوم').getAttribute('aria-checked')).toBe('false');
    await screen.unmount();
  });

  function Palette() {
    return (
      <CommandPalette
        triggerLabel="بحث"
        title="بحث وأوامر"
        inputLabel="ابحث عن مريض أو إجراء"
        groups={[
          {
            label: 'المرضى',
            items: [
              { value: 'p1', label: 'أحمد خليل', description: 'ملف 1187' },
              { value: 'p2', label: 'سارة الأحمد', description: 'ملف 1042' },
            ],
          },
        ]}
        onAction={() => undefined}
        emptyText={() => 'لا نتائج'}
      />
    );
  }

  async function openPalette() {
    const screen = await renderDir(<Palette />);
    await userEvent.click(screen.getByRole('button', { name: 'بحث' }));
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    await poll(() => document.activeElement, 'focus in the field').toBe(input);
    return { screen, input };
  }

  const shown = () =>
    [...document.querySelectorAll('[role="option"]')].filter(
      (el) => el.closest('[hidden]') === null,
    ).length;

  it('N7: Escape clears typed text first, then one Escape closes', async () => {
    const { screen, input } = await openPalette();
    await typeArabic(input, 'احمد');
    await userEvent.keyboard('{Escape}');
    await poll(() => input.value, 'cleared').toBe('');
    expect(screen.getByRole('dialog').element().isConnected).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await screen.unmount();
  });

  it('N8: an option is found by its second line, Western or Arabic-Indic digits', async () => {
    const { screen, input } = await openPalette();
    await typeArabic(input, '1187');
    await poll(shown, 'found by its record number').toBe(1);
    await typeArabic(input, '١١٨٧');
    await poll(shown, 'found with Arabic-Indic digits').toBe(1);
    await screen.unmount();
  });
});
