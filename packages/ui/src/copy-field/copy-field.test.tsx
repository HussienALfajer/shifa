// CopyField (slice A-01-10), as the owner approved the sheet on 2026-11-24 (`CopyFieldSheet`): a
// value shown once to copy or send, read-only, left to right in the mono font in both directions,
// copy inside the box at the logical end, an optional WhatsApp share and expiry line; focus selects
// the text; copied says so for three seconds; a refused copy selects the text and asks to copy it
// by hand; multiline and an icon-only copy on a phone; disabled (a replaced link); loading.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { CopyField } from './copy-field.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const URL = 'https://clinic.shifa.example/setup#t=Qm9ndXMtc3ludGhldGljLXRva2VuLTAwMDE';
const WA = `https://wa.me/?text=${encodeURIComponent(URL)}`;
const LABEL = 'رابط الإعداد';

function stubClipboard(ok = true) {
  const writeText = vi.fn(() => (ok ? Promise.resolve() : Promise.reject(new Error('denied'))));
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

const box = () => document.querySelector<HTMLElement>('[data-slot="copy-field"]');
const valueEl = () =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-slot="copy-field-value"]');
const selected = () => {
  const el = valueEl();
  return el ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : '';
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(DIRS)('CopyField in %s', (dir) => {
  it('shows the value read-only, named, left to right in the mono font', async () => {
    const screen = await renderDir(<CopyField value={URL} label={LABEL} />, { dir });
    const input = screen.getByRole('textbox', { name: LABEL }).element() as HTMLInputElement;
    expect(input.value).toBe(URL);
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('dir')).toBe('ltr');
    expect(input.getAttribute('translate')).toBe('no');
    expect(getComputedStyle(input).fontFamily.toLowerCase()).toContain('mono');
    await screen.unmount();
  });

  it('puts the copy button inside the box at the logical end', async () => {
    const screen = await renderDir(<CopyField value={URL} label={LABEL} />, { dir });
    const field = box()?.getBoundingClientRect();
    const copy = screen.getByRole('button', { name: 'نسخ' }).element().getBoundingClientRect();
    const value = valueEl()?.getBoundingClientRect();
    expect(field && value).toBeTruthy();
    if (field && value) {
      expect(copy.left).toBeGreaterThanOrEqual(field.left);
      expect(copy.right).toBeLessThanOrEqual(field.right);
      // RTL: the end is the left; LTR: the right.
      if (dir === 'rtl') expect(copy.right).toBeLessThanOrEqual(value.left + 1);
      else expect(copy.left).toBeGreaterThanOrEqual(value.right - 1);
    }
    await screen.unmount();
  });

  it('selects the whole value on focus', async () => {
    const screen = await renderDir(<CopyField value={URL} label={LABEL} />, { dir });
    await userEvent.click(screen.getByRole('textbox', { name: LABEL }));
    await expect.poll(selected).toBe(URL);
    await screen.unmount();
  });

  it('copies the value, says so for three seconds, and announces it once', async () => {
    const writeText = stubClipboard();
    const onCopied = vi.fn();
    const screen = await renderDir(<CopyField value={URL} label={LABEL} onCopied={onCopied} />, {
      dir,
    });
    await userEvent.click(screen.getByRole('button', { name: 'نسخ' }));
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(onCopied).toHaveBeenCalledOnce();
    await expect.poll(() => screen.getByRole('button', { name: 'نُسخ' }).query()).not.toBeNull();
    expect(screen.getByRole('status').element().textContent).toBe('نُسخ');
    await expect
      .poll(() => screen.getByRole('button', { name: 'نسخ' }).query(), { timeout: 4500 })
      .not.toBeNull();
    await screen.unmount();
  });

  it('a refused copy selects the text and asks to copy it by hand', async () => {
    stubClipboard(false);
    const onCopied = vi.fn();
    const screen = await renderDir(<CopyField value={URL} label={LABEL} onCopied={onCopied} />, {
      dir,
    });
    await userEvent.click(screen.getByRole('button', { name: 'نسخ' }));
    await expect
      .poll(() => screen.getByText('لم يُنسخ. الرابط محدّد: انسخه بنفسك.').query())
      .not.toBeNull();
    expect(onCopied).not.toHaveBeenCalled();
    expect(selected()).toBe(URL);
    expect(document.activeElement).toBe(valueEl());
    await screen.unmount();
  });

  it('offers the WhatsApp share as a link to the given address, in a new tab', async () => {
    const onShared = vi.fn();
    const screen = await renderDir(
      <CopyField
        value={URL}
        label={LABEL}
        share={{ href: WA, label: 'إرسال عبر واتساب' }}
        onShared={onShared}
      />,
      { dir },
    );
    const link = screen.getByRole('link', { name: 'إرسال عبر واتساب' }).element();
    expect(link.getAttribute('href')).toBe(WA);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('rel')).toContain('noopener');
    link.addEventListener('click', (e) => {
      e.preventDefault();
    });
    await userEvent.click(link);
    expect(onShared).toHaveBeenCalledOnce();
    await screen.unmount();
  });

  it('shows the expiry line under the box, described by it', async () => {
    const screen = await renderDir(
      <CopyField value={URL} label={LABEL} expiry="ينتهي بعد 72 ساعة" />,
      { dir },
    );
    const input = screen.getByRole('textbox', { name: LABEL }).element();
    const id = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(id)?.textContent).toBe('ينتهي بعد 72 ساعة');
    await screen.unmount();
  });

  it('wraps a long value on several lines when multiline', async () => {
    const screen = await renderDir(
      <div style={{ width: 280 }}>
        <CopyField value={URL} label={LABEL} multiline />
      </div>,
      { dir },
    );
    const el = valueEl();
    expect(el?.tagName).toBe('TEXTAREA');
    expect((el as HTMLTextAreaElement).readOnly).toBe(true);
    expect(el?.scrollHeight ?? 0).toBeLessThanOrEqual((el?.clientHeight ?? 0) + 1);
    expect(el?.clientHeight ?? 0).toBeGreaterThan(40);
    await screen.unmount();
  });

  it('has an icon-only copy, still named, when compact', async () => {
    const screen = await renderDir(<CopyField value={URL} label={LABEL} iconOnly />, { dir });
    const copy = screen.getByRole('button', { name: 'نسخ' }).element();
    expect(copy.textContent.trim()).toBe('');
    await screen.unmount();
  });

  it('disabled: no copy, no share, the value muted', async () => {
    const writeText = stubClipboard();
    const screen = await renderDir(
      <CopyField
        value={URL}
        label={LABEL}
        disabled
        share={{ href: WA, label: 'إرسال عبر واتساب' }}
        expiry="استُبدل هذا الرابط"
      />,
      { dir },
    );
    const copy = screen.getByRole('button', { name: 'نسخ' });
    await userEvent.click(copy, { force: true });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'إرسال عبر واتساب' }).query()).toBeNull();
    const input = valueEl();
    if (input) {
      expect(getComputedStyle(input).color).toBe(tokenColor('--shifa-color-text-muted', input));
    }
    await screen.unmount();
  });

  it('without a value it is loading: busy, nothing to copy', async () => {
    const screen = await renderDir(<CopyField label={LABEL} />, { dir });
    expect(box()?.getAttribute('aria-busy')).toBe('true');
    expect(valueEl()).toBeNull();
    expect(screen.getByRole('button', { name: 'نسخ' }).query()).toBeNull();
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe-clean in %s', async (theme) => {
    const screen = await renderDir(
      <CopyField
        value={URL}
        label={LABEL}
        share={{ href: WA, label: 'إرسال عبر واتساب' }}
        expiry="ينتهي بعد 72 ساعة"
      />,
      { dir, theme },
    );
    await expectAxeClean(document.body);
    await screen.unmount();
  });
});
