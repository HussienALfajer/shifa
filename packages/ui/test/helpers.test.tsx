// Slice 0.4-03: the RTL test helpers that 0.4-04 uses for the gate. Each one passes on a correct
// fixture and fails on a deliberately wrong one (an arrow that moves backwards, a popup on the
// wrong side, typed Arabic that is dropped, Arabic-Indic digits stored as typed, a nameless button).
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { type CSSProperties, type KeyboardEvent, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useDirection } from '../src/index.ts';
import { toWesternDigits } from '../src/lib/digits.ts';
import {
  expectArrow,
  expectAxeClean,
  expectDigitsAccepted,
  expectPopupSide,
  renderDir,
  typeArabic,
  waitForPopupSide,
} from './support/index.ts';

const DIRS = ['rtl', 'ltr'] as const;
const NAME = fullName(
  generatePersonName(createRandom(403), { sex: 'female', adult: false, region: 'aleppo' }),
);

// Fixture geometry (px): a 400-wide row, an 80-wide trigger and a 200-wide popup under it. Kept
// out of inline style literals, which the design-value lint rule reads as product styling.
const ROW: CSSProperties = {
  position: 'relative',
  width: 400,
  display: 'flex',
  justifyContent: 'center',
};
const ANCHOR: CSSProperties = { position: 'relative' };
const TRIGGER: CSSProperties = { width: 80 };
const POPUP: CSSProperties = { position: 'absolute', top: '100%', width: 200, height: 40 };
const AT_LEFT: CSSProperties = { left: 0 };
const AT_RIGHT: CSSProperties = { right: 0 };

/** Three buttons with a roving focus. `ignoreDir` makes ArrowRight "forward" even in RTL. */
function Toolbar({ ignoreDir = false }: { ignoreDir?: boolean }) {
  const dir = useDirection();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const forward = ignoreDir || dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';
  const backward = forward === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === forward ? 1 : event.key === backward ? -1 : 0;
    if (step === 0) return;
    const next = Math.min(2, Math.max(0, active + step));
    setActive(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="toolbar" aria-label="أدوات" onKeyDown={onKeyDown}>
      {['أ', 'ب', 'ج'].map((label, i) => (
        <button
          key={label}
          type="button"
          tabIndex={i === active ? 0 : -1}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A trigger and an open popup aligned to the trigger's inline-start edge, or to its left edge. */
function Popup({ physical = false }: { physical?: boolean }) {
  const dir = useDirection();
  const popup = { ...POPUP, ...(physical || dir === 'ltr' ? AT_LEFT : AT_RIGHT) };
  return (
    <div style={ROW}>
      <div style={ANCHOR}>
        <button type="button" data-testid="trigger" style={TRIGGER}>
          فتح
        </button>
        <div data-testid="popup" style={popup} />
      </div>
    </div>
  );
}

function TextField({ dropArabic = false }: { dropArabic?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <input
      aria-label="الاسم"
      value={value}
      onChange={(e) => {
        setValue(dropArabic ? e.target.value.replace(/[^ -~]/g, '') : e.target.value);
      }}
    />
  );
}

function DigitField({ convert = true }: { convert?: boolean }) {
  const [stored, setStored] = useState('');
  return (
    <input
      aria-label="رقم الهاتف"
      data-stored={stored}
      onChange={(e) => {
        setStored(convert ? toWesternDigits(e.target.value) : e.target.value);
      }}
    />
  );
}

describe('renderDir', () => {
  it('renders inside the direction, theme and density asked for', async () => {
    const screen = await renderDir(<span data-testid="probe">x</span>, {
      dir: 'ltr',
      theme: 'dark',
      density: 'compact',
    });
    const probe = screen.getByTestId('probe').element();
    expect(probe.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
    expect(probe.closest('[data-theme]')?.getAttribute('data-theme')).toBe('dark');
    expect(probe.closest('[data-density]')?.getAttribute('data-density')).toBe('compact');
  });

  it('defaults to Arabic RTL, light, comfortable', async () => {
    const screen = await renderDir(<span data-testid="probe">x</span>);
    const probe = screen.getByTestId('probe').element();
    expect(probe.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    expect(probe.closest('[lang]')?.getAttribute('lang')).toBe('ar');
    expect(probe.closest('[data-theme]')?.getAttribute('data-theme')).toBe('light');
    expect(probe.closest('[data-density]')?.getAttribute('data-density')).toBe('comfortable');
  });
});

describe.each(DIRS)('helpers in %s', (dir) => {
  it('expectArrow passes when the forward arrow follows the direction', async () => {
    const screen = await renderDir(<Toolbar />, { dir });
    await expectArrow({ dir, items: screen.getByRole('button').elements() });
  });

  it('expectArrow fails when the arrow moves backwards', async () => {
    if (dir === 'ltr') return; // ArrowRight is forward in LTR, so the wrong fixture is right there.
    const screen = await renderDir(<Toolbar ignoreDir />, { dir });
    await expect(
      expectArrow({ dir, items: screen.getByRole('button').elements() }),
    ).rejects.toThrow();
  });

  it('expectPopupSide passes for a popup below, aligned to the inline start', async () => {
    const screen = await renderDir(<Popup />, { dir });
    expectPopupSide({
      dir,
      trigger: screen.getByTestId('trigger').element(),
      popup: screen.getByTestId('popup').element(),
      side: 'bottom',
      align: 'start',
    });
  });

  it('expectPopupSide fails for a popup on the physical left in RTL, or the wrong side', async () => {
    const screen = await renderDir(<Popup physical={dir === 'rtl'} />, { dir });
    const call = (side: 'bottom' | 'top', align: 'start' | 'end') => () => {
      expectPopupSide({
        dir,
        trigger: screen.getByTestId('trigger').element(),
        popup: screen.getByTestId('popup').element(),
        side,
        align,
      });
    };
    expect(call('top', 'start')).toThrow();
    if (dir === 'rtl') expect(call('bottom', 'start')).toThrow();
    else expect(call('bottom', 'end')).toThrow();
  });

  it('waitForPopupSide passes a settled popup and still fails a misplaced one', async () => {
    const screen = await renderDir(<Popup />, { dir });
    const args = {
      dir,
      trigger: screen.getByTestId('trigger').element(),
      popup: screen.getByTestId('popup').element(),
    };
    await waitForPopupSide({ ...args, side: 'bottom', align: 'start' });
    await expect(waitForPopupSide({ ...args, side: 'top', align: 'start' }, 100)).rejects.toThrow();
  });

  it('typeArabic passes when the field keeps the Arabic text', async () => {
    const screen = await renderDir(<TextField />, { dir });
    await typeArabic(screen.getByRole('textbox').element() as HTMLInputElement, NAME);
  });

  it('typeArabic fails when the field drops the Arabic letters', async () => {
    const screen = await renderDir(<TextField dropArabic />, { dir });
    const input = screen.getByRole('textbox').element() as HTMLInputElement;
    await expect(typeArabic(input, NAME)).rejects.toThrow();
  });

  it('expectDigitsAccepted passes when Arabic-Indic digits are stored as Western ones', async () => {
    const screen = await renderDir(<DigitField />, { dir });
    const input = screen.getByRole('textbox').element() as HTMLInputElement;
    await expectDigitsAccepted({ input, stored: () => input.dataset['stored'] ?? '' });
  });

  it('expectDigitsAccepted fails when the typed digits are stored as typed', async () => {
    const screen = await renderDir(<DigitField convert={false} />, { dir });
    const input = screen.getByRole('textbox').element() as HTMLInputElement;
    await expect(
      expectDigitsAccepted({ input, stored: () => input.dataset['stored'] ?? '' }),
    ).rejects.toThrow();
  });

  it('expectAxeClean passes a named button and fails a nameless one', async () => {
    const good = await renderDir(<button type="button">حفظ</button>, { dir });
    await expectAxeClean(good.container);
    const bad = await renderDir(
      <button type="button">
        <svg aria-hidden="true" width="20" height="20" />
      </button>,
      { dir },
    );
    await expect(expectAxeClean(bad.container)).rejects.toThrow(/button-name/);
  });
});

describe('toWesternDigits', () => {
  it('maps Arabic-Indic and Eastern Arabic-Indic digits and leaves the rest', () => {
    expect(toWesternDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toWesternDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toWesternDigits('غرفة ٣ - 12')).toBe('غرفة 3 - 12');
  });
});
