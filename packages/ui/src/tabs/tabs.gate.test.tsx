// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Tabs in Arabic RTL and English LTR. Arrows follow
// the reading direction, a disabled tab is reachable but never selected, Home and End reach the ends, only the selected
// tab is in the tab order, the selected tab is marked by more than colour, axe is clean.
// Popup side, Arabic typeahead and digits do not apply to tabs (n/a in the results table).
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  arrows,
  expectArrow,
  expectAxeClean,
  renderDir,
  tokenColor,
} from '../../test/support/index.ts';
import { Tab, TabList, TabPanel, Tabs } from './tabs.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const LABELS = { summary: 'الملخص', visits: 'الزيارات', files: 'المرفقات', bills: 'الفواتير' };

function PatientTabs() {
  return (
    <Tabs defaultValue="summary">
      <TabList aria-label="ملف المريض">
        <Tab value="summary">{LABELS.summary}</Tab>
        <Tab value="visits">{LABELS.visits}</Tab>
        <Tab value="files" disabled>
          {LABELS.files}
        </Tab>
        <Tab value="bills">{LABELS.bills}</Tab>
      </TabList>
      <TabPanel value="summary">آخر زيارة: 12/11/2026</TabPanel>
      <TabPanel value="visits">ثلاث زيارات</TabPanel>
      <TabPanel value="files">لا مرفقات</TabPanel>
      <TabPanel value="bills">لا فواتير مستحقة</TabPanel>
    </Tabs>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 500, message });

describe.each(DIRS)('Tabs gate in %s', (dir) => {
  it('renders a named tablist of tabs with one selected tab and its panel', async () => {
    const screen = await renderDir(<PatientTabs />, { dir });
    const list = screen.getByRole('tablist', { name: 'ملف المريض' }).element();
    const tabs = screen.getByRole('tab').elements();
    expect(tabs).toHaveLength(4);
    expect(list.contains(tabs[0] ?? null)).toBe(true);
    const selected = screen.getByRole('tab', { name: LABELS.summary }).element();
    expect(selected.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel').element();
    expect(panel.textContent).toContain('12/11/2026');
    expect(selected.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('moves with the arrow of the reading direction (Left is next in RTL)', async () => {
    const screen = await renderDir(<PatientTabs />, { dir });
    await expectArrow({
      dir,
      items: [
        screen.getByRole('tab', { name: LABELS.summary }).element(),
        screen.getByRole('tab', { name: LABELS.visits }).element(),
      ],
    });
  });

  it('reaches the disabled tab (it says it is disabled) but never selects it', async () => {
    const screen = await renderDir(<PatientTabs />, { dir });
    const visits = screen.getByRole('tab', { name: LABELS.visits }).element() as HTMLElement;
    visits.focus();
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    const files = screen.getByRole('tab', { name: LABELS.files }).element();
    await poll(() => document.activeElement, 'forward reaches the disabled tab').toBe(files);
    expect(files.getAttribute('aria-disabled')).toBe('true');
    expect(files.getAttribute('aria-selected')).toBe('false');
    await userEvent.keyboard('{Enter}');
    expect(files.getAttribute('aria-selected')).toBe('false');
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    await poll(() => document.activeElement?.textContent, 'and on to the next').toBe(LABELS.bills);
  });

  it('Home and End reach the first and the last tab', async () => {
    const screen = await renderDir(<PatientTabs />, { dir });
    (screen.getByRole('tab', { name: LABELS.visits }).element() as HTMLElement).focus();
    await userEvent.keyboard('{End}');
    await poll(() => document.activeElement?.textContent, 'End').toBe(LABELS.bills);
    await userEvent.keyboard('{Home}');
    await poll(() => document.activeElement?.textContent, 'Home').toBe(LABELS.summary);
  });

  it('selecting a tab shows its panel (automatic activation)', async () => {
    const screen = await renderDir(<PatientTabs />, { dir });
    (screen.getByRole('tab', { name: LABELS.summary }).element() as HTMLElement).focus();
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    const visits = screen.getByRole('tab', { name: LABELS.visits }).element();
    await poll(() => visits.getAttribute('aria-selected'), 'the focused tab is selected').toBe(
      'true',
    );
    await poll(() => screen.getByRole('tabpanel').element().textContent, 'its panel').toBe(
      'ثلاث زيارات',
    );
  });

  it('keeps only the selected tab in the tab order; focus is returned there', async () => {
    const screen = await renderDir(
      <>
        <button type="button">قبل</button>
        <PatientTabs />
      </>,
      { dir },
    );
    (screen.getByRole('button', { name: 'قبل' }).element() as HTMLElement).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: LABELS.summary }).element(),
    );
    await userEvent.tab();
    // The next stop is the panel (or what it holds), never another tab.
    expect(document.activeElement?.getAttribute('role')).not.toBe('tab');
  });

  it('marks the selected tab by weight and an underline in the brand colour, not colour alone', async () => {
    const screen = await renderDir(<PatientTabs />, { dir });
    const selected = screen.getByRole('tab', { name: LABELS.summary }).element();
    const other = screen.getByRole('tab', { name: LABELS.visits }).element();
    const s = getComputedStyle(selected);
    expect(s.color).toBe(tokenColor('--shifa-color-brand-primary', selected));
    expect(s.borderBottomColor).toBe(tokenColor('--shifa-color-brand-primary', selected));
    expect(s.borderBottomWidth).toBe('2px');
    expect(Number(s.fontWeight)).toBeGreaterThan(Number(getComputedStyle(other).fontWeight));
    const disabled = screen.getByRole('tab', { name: LABELS.files }).element();
    expect(getComputedStyle(disabled).color).toBe(
      tokenColor('--shifa-color-text-disabled', disabled),
    );
  });

  it('shows the 2 px focus ring on a tab reached by keyboard', async () => {
    const screen = await renderDir(
      <>
        <button type="button">قبل</button>
        <PatientTabs />
      </>,
      { dir },
    );
    (screen.getByRole('button', { name: 'قبل' }).element() as HTMLElement).focus();
    await userEvent.tab();
    const tab = document.activeElement as HTMLElement;
    expect(getComputedStyle(tab).outlineStyle).toBe('solid');
    expect(getComputedStyle(tab).outlineWidth).toBe('2px');
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<PatientTabs />, { dir, theme });
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
