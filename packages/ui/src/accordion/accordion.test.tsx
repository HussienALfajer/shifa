// Accordion (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet on
// 2026-11-22: each section's header is a button inside a heading, with a caret at the logical
// end that turns over when open. Enter and Space open and close; the vertical arrows move between
// headers and skip a disabled one; Home and End reach the first and the last. One section open at
// a time by default, several with `multiple`. Open and closed are told by more than colour.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { Accordion, AccordionItem } from './accordion.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const T = {
  allergies: 'الحساسية والأمراض المزمنة',
  medicines: 'الأدوية الحالية',
  visits: 'الزيارات السابقة',
  insurance: 'ملاحظات التأمين',
};

function PatientSections({ multiple }: { multiple?: boolean }) {
  return (
    <Accordion defaultValue={['allergies']} {...(multiple === undefined ? {} : { multiple })}>
      <AccordionItem value="allergies" title={T.allergies}>
        حساسية من البنسلين
      </AccordionItem>
      <AccordionItem value="medicines" title={T.medicines}>
        أملوديبين 5 ملغ، مرة يومياً
      </AccordionItem>
      <AccordionItem value="insurance" title={T.insurance} disabled>
        لا تأمين
      </AccordionItem>
      <AccordionItem value="visits" title={T.visits} badge="4">
        أربع زيارات هذا العام
      </AccordionItem>
    </Accordion>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

describe.each(DIRS)('Accordion in %s', (dir) => {
  it('renders each header as a button in a heading, with its panel named by it', async () => {
    const screen = await renderDir(<PatientSections />, { dir });
    const open = screen.getByRole('button', { name: T.allergies }).element();
    expect(open.closest('h3')).not.toBeNull();
    expect(open.getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('region', { name: T.allergies }).element();
    expect(open.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toContain('البنسلين');
    const closed = screen.getByRole('button', { name: T.medicines }).element();
    expect(closed.getAttribute('aria-expanded')).toBe('false');
    await screen.unmount();
  });

  it('Enter and Space open and close; one section open at a time by default', async () => {
    const screen = await renderDir(<PatientSections />, { dir });
    const allergies = screen.getByRole('button', { name: T.allergies }).element() as HTMLElement;
    const medicines = screen.getByRole('button', { name: T.medicines }).element() as HTMLElement;
    medicines.focus();
    await userEvent.keyboard('{Enter}');
    await poll(() => medicines.getAttribute('aria-expanded'), 'medicines open').toBe('true');
    await poll(() => allergies.getAttribute('aria-expanded'), 'allergies closed').toBe('false');
    await userEvent.keyboard(' ');
    await poll(() => medicines.getAttribute('aria-expanded'), 'closed by Space').toBe('false');
    await screen.unmount();
  });

  it('keeps several sections open with multiple', async () => {
    const screen = await renderDir(<PatientSections multiple />, { dir });
    await userEvent.click(screen.getByRole('button', { name: T.medicines }));
    const allergies = screen.getByRole('button', { name: T.allergies }).element();
    const medicines = screen.getByRole('button', { name: T.medicines }).element();
    await poll(() => medicines.getAttribute('aria-expanded'), 'medicines open').toBe('true');
    expect(allergies.getAttribute('aria-expanded')).toBe('true');
    await screen.unmount();
  });

  it('moves between headers with the vertical arrows, skipping a disabled one; Home and End', async () => {
    const screen = await renderDir(<PatientSections />, { dir });
    const header = (name: string) => screen.getByRole('button', { name }).element();
    (header(T.allergies) as HTMLElement).focus();
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => document.activeElement, 'down to medicines').toBe(header(T.medicines));
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => document.activeElement, 'past the disabled one').toBe(header(T.visits));
    await userEvent.keyboard('{ArrowUp}');
    await poll(() => document.activeElement, 'up to medicines').toBe(header(T.medicines));
    await userEvent.keyboard('{Home}');
    await poll(() => document.activeElement, 'Home').toBe(header(T.allergies));
    await userEvent.keyboard('{End}');
    await poll(() => document.activeElement, 'End').toBe(header(T.visits));
    await screen.unmount();
  });

  it('a disabled section never opens', async () => {
    const screen = await renderDir(<PatientSections />, { dir });
    const insurance = screen.getByRole('button', { name: T.insurance });
    await userEvent.click(insurance, { force: true });
    expect(insurance.element().getAttribute('aria-expanded')).toBe('false');
    await screen.unmount();
  });

  it('puts the caret at the logical end and turns it over when open', async () => {
    const screen = await renderDir(<PatientSections />, { dir });
    const header = screen.getByRole('button', { name: T.medicines }).element();
    const caret = header.querySelector('svg');
    if (caret === null) throw new Error('no caret');
    const h = header.getBoundingClientRect();
    const c = caret.getBoundingClientRect();
    if (dir === 'rtl') expect(c.left - h.left).toBeLessThan(h.right - c.right);
    else expect(h.right - c.right).toBeLessThan(c.left - h.left);
    const closedTurn = getComputedStyle(caret).rotate;
    const openCaret = screen
      .getByRole('button', { name: T.allergies })
      .element()
      .querySelector('svg');
    if (openCaret === null) throw new Error('no caret');
    expect(getComputedStyle(openCaret).rotate).not.toBe(closedTurn);
    await screen.unmount();
  });

  it('an open header is heavier, not only another colour; the focus ring shows', async () => {
    const screen = await renderDir(<PatientSections />, { dir });
    const open = screen.getByRole('button', { name: T.allergies }).element() as HTMLElement;
    const closed = screen.getByRole('button', { name: T.medicines }).element();
    expect(Number(getComputedStyle(open).fontWeight)).toBeGreaterThan(
      Number(getComputedStyle(closed).fontWeight),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(open);
    await expectFocusRing(open);
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<PatientSections />, { dir, theme });
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
