// Card (slice 0.4-07), as the owner approved the sheet on 2026-11-22: a white surface on cream with
// an optional header (title, description, actions), a body and a footer. A card is not
// interactive by itself. A link card puts one real link in its title and the whole card is the
// link's hit area; a button inside stays its own control (no nested interactive elements). The
// focus ring of the link is drawn on the whole card.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { Card, CardBody, CardFooter, CardHeader, CardLink } from './card.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** The one element matching `selector`; fails the test when there is none. */
function one(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${selector}`);
  return el;
}
const [patient, other] = people(2);
const PATIENT = patient?.name ?? '';
const OTHER = other?.name ?? '';

function Appointment({ onCheckIn }: { onCheckIn?: () => void }) {
  return (
    <Card>
      <CardHeader title="موعد اليوم" description="الأحد 22/11/2026 · 10:30" />
      <CardBody>{OTHER}</CardBody>
      <CardFooter>
        <Button variant="primary" size="sm" {...(onCheckIn ? { onClick: onCheckIn } : {})}>
          سجّل الوصول
        </Button>
      </CardFooter>
    </Card>
  );
}

function PatientLinkCard({
  onOpen,
  onMore,
}: {
  onOpen: (e: React.MouseEvent) => void;
  onMore?: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title={
          <CardLink href="#patient-10482" onClick={onOpen}>
            {PATIENT}
          </CardLink>
        }
        description="ملف رقم P-10482"
        actions={
          <Button size="sm" variant="ghost" {...(onMore ? { onClick: onMore } : {})}>
            المزيد
          </Button>
        }
      />
      <CardBody>رصيد مستحق 45,000 ل.س</CardBody>
    </Card>
  );
}

describe.each(DIRS)('Card in %s', (dir) => {
  it('is a surface, not a control: no role, no Tab stop', async () => {
    const screen = await renderDir(<Appointment />, { dir });
    const card = one('[data-slot="card"]');
    expect(card.getAttribute('role')).toBeNull();
    expect(card.hasAttribute('tabindex')).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'سجّل الوصول' }).element(),
    );
    await screen.unmount();
  });

  it('draws the card tokens and a heading title', async () => {
    const screen = await renderDir(<Appointment />, { dir });
    const card = one('[data-slot="card"]');
    const style = getComputedStyle(card);
    expect(style.backgroundColor).toBe(tokenColor('--shifa-card-bg', card));
    expect(style.borderTopLeftRadius).toBe('12px');
    expect(style.boxShadow).not.toBe('none');
    expect(screen.getByRole('heading', { name: 'موعد اليوم' }).element()).toBeTruthy();
    await screen.unmount();
  });

  it('a link card: one link, and a press anywhere on the card follows it', async () => {
    const onOpen = vi.fn((e: React.MouseEvent) => {
      e.preventDefault();
    });
    const screen = await renderDir(<PatientLinkCard onOpen={onOpen} />, { dir });
    expect(document.querySelectorAll('[data-slot="card"] a')).toHaveLength(1);
    await userEvent.click(screen.getByText('رصيد مستحق 45,000 ل.س'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('a button inside a link card stays its own control', async () => {
    const onOpen = vi.fn((e: React.MouseEvent) => {
      e.preventDefault();
    });
    const onMore = vi.fn();
    const screen = await renderDir(<PatientLinkCard onOpen={onOpen} onMore={onMore} />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'المزيد' }));
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    // Nothing interactive is nested inside the link.
    const link = screen.getByRole('link', { name: PATIENT }).element();
    expect(link.querySelector('a, button, input, [tabindex]')).toBeNull();
    await screen.unmount();
  });

  it('a link card shows the focus ring on the whole card', async () => {
    const screen = await renderDir(<PatientLinkCard onOpen={() => undefined} />, { dir });
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: PATIENT }).element());
    const card = one('[data-slot="card"]');
    const want = tokenColor('--shifa-color-border-focus', card);
    await expect
      .poll(() => {
        const s = getComputedStyle(card);
        return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
      })
      .toBe(`solid 2px ${want}`);
    await screen.unmount();
  });

  it('the header actions sit at the logical end', async () => {
    const screen = await renderDir(<PatientLinkCard onOpen={() => undefined} />, { dir });
    const title = screen.getByRole('link', { name: PATIENT }).element().getBoundingClientRect();
    const more = screen.getByRole('button', { name: 'المزيد' }).element().getBoundingClientRect();
    if (dir === 'rtl') expect(more.left).toBeLessThan(title.left);
    else expect(more.left).toBeGreaterThan(title.left);
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <>
          <Appointment />
          <PatientLinkCard onOpen={() => undefined} />
        </>,
        { dir, theme },
      );
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
