// CodeList (slice A-01-07), as the owner approved the sheet on 2026-11-24 (`CodeListSheet`): ten
// numbered recovery codes in two columns laid out left to right in both directions, «نسخ الكل»
// (one line per code, no numbers, «نُسخت الرموز العشرة» for three seconds) and «طباعة» (the light
// print sheet alone, with the person, the clinic and the date). Nothing is stored.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { CodeList, type CodeListPrint } from './code-list.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const CODES = [
  'k7m2q-9xw4r',
  'h8zdt-3npwa',
  'p5rte-9cqeb',
  'b2nvk-7yfgm',
  'x6gjh-4tsmq',
  'c9wat-3hune',
  'r4yxe-6bnqz',
  'f7mck-2vjta',
  'u3ksy-5wgad',
  'd8qpm-4rzhe',
];
const PRINT: CodeListPrint = {
  title: 'رموز الاسترداد لحساب شفاء',
  who: 'شخص تجريبي · عيادة تجريبية',
  date: 'طُبعت 24/11/2026',
  note: 'كل رمز يعمل مرة واحدة؛ اشطب ما تستعمله.',
};

function stubClipboard() {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(DIRS)('CodeList in %s', (dir) => {
  it('lists the ten codes in order as a named, numbered list', async () => {
    const screen = await renderDir(<CodeList codes={CODES} />, { dir });
    const list = screen.getByRole('list', { name: 'رموز الاسترداد العشرة' }).element();
    expect(list.tagName).toBe('OL');
    const codes = [...list.querySelectorAll('[data-slot="code"]')].map((c) => c.textContent);
    expect(codes).toEqual(CODES);
    expect(list.querySelectorAll('li')[0]?.textContent).toBe('1.k7m2q-9xw4r');
    await screen.unmount();
  });

  it('lays the codes out left to right in two columns, in both directions', async () => {
    const screen = await renderDir(<CodeList codes={CODES} />, { dir });
    const items = [...document.querySelectorAll('[data-slot="code-list"] li')].map((li) =>
      li.getBoundingClientRect(),
    );
    const [first, second, third] = items as [DOMRect, DOMRect, DOMRect];
    expect(Math.abs(first.top - second.top)).toBeLessThan(1);
    expect(second.left).toBeGreaterThan(first.left);
    expect(third.top).toBeGreaterThan(first.top);
    await screen.unmount();
  });

  it('shows codes in the mono font on the raised surface', async () => {
    const screen = await renderDir(<CodeList codes={CODES} />, { dir });
    const code = document.querySelector<HTMLElement>('[data-slot="code"]');
    const cell = code?.closest('li');
    const number = cell?.querySelector('span');
    expect(code).not.toBeNull();
    // The code is in the mono family; its number beside it is in the UI family.
    if (code && number) {
      expect(getComputedStyle(code).fontFamily).not.toBe(getComputedStyle(number).fontFamily);
      expect(getComputedStyle(code).fontFamily.toLowerCase()).toContain('mono');
    }
    if (cell) {
      expect(getComputedStyle(cell).backgroundColor).toBe(
        tokenColor('--shifa-color-bg-surface-raised', cell),
      );
    }
    await screen.unmount();
  });

  it('copies one code per line without numbers, then says so for three seconds', async () => {
    const writeText = stubClipboard();
    const onCopied = vi.fn();
    const screen = await renderDir(<CodeList codes={CODES} onCopied={onCopied} />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'نسخ الكل' }));
    expect(writeText).toHaveBeenCalledWith(CODES.join('\n'));
    expect(onCopied).toHaveBeenCalledOnce();
    await expect
      .poll(() => screen.getByRole('button', { name: 'نُسخت الرموز العشرة' }).query())
      .not.toBeNull();
    await expect
      .poll(() => screen.getByRole('button', { name: 'نسخ الكل' }).query(), { timeout: 4500 })
      .not.toBeNull();
    await screen.unmount();
  });

  it('a refused clipboard changes nothing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    const onCopied = vi.fn();
    const screen = await renderDir(<CodeList codes={CODES} onCopied={onCopied} />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'نسخ الكل' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onCopied).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'نسخ الكل' }).query()).not.toBeNull();
    await screen.unmount();
  });

  it('prints the sheet alone: hidden on screen, the person, clinic, date and codes on it', async () => {
    const print = vi.spyOn(globalThis, 'print').mockImplementation(() => undefined);
    const screen = await renderDir(<CodeList codes={CODES} print={PRINT} />, { dir });
    const sheet = document.querySelector<HTMLElement>('[data-slot="code-list-print"]');
    expect(sheet).not.toBeNull();
    if (sheet) {
      expect(sheet.parentElement).toBe(document.body);
      expect(getComputedStyle(sheet).display).toBe('none');
      expect(sheet.textContent).toContain(PRINT.title);
      expect(sheet.textContent).toContain(PRINT.who);
      expect(sheet.textContent).toContain(PRINT.date);
      for (const code of CODES) expect(sheet.textContent).toContain(code);
    }
    await userEvent.click(screen.getByRole('button', { name: 'طباعة' }));
    expect(print).toHaveBeenCalledOnce();
    await screen.unmount();
    expect(document.querySelector('[data-slot="code-list-print"]')).toBeNull();
  });

  it('without print details there is no print button', async () => {
    const screen = await renderDir(<CodeList codes={CODES} />, { dir });
    expect(screen.getByRole('button', { name: 'طباعة' }).query()).toBeNull();
    await screen.unmount();
  });

  it('the compact density is tighter than the comfortable one', async () => {
    const pad = () => {
      const li = document.querySelector('[data-slot="code-list"] li');
      return li ? Number.parseFloat(getComputedStyle(li).paddingInlineStart) : 0;
    };
    const roomy = await renderDir(<CodeList codes={CODES} />, { dir });
    const a = pad();
    await roomy.unmount();
    const tight = await renderDir(<CodeList codes={CODES} />, { dir, density: 'compact' });
    const b = pad();
    await tight.unmount();
    expect(b).toBeLessThan(a);
  });

  it.each(['light', 'dark'] as const)('is axe-clean in %s', async (theme) => {
    const screen = await renderDir(<CodeList codes={CODES} print={PRINT} />, { dir, theme });
    await expectAxeClean(document.body);
    await screen.unmount();
  });
});
