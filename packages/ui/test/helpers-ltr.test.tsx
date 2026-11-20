// Slice 0.4-03 review: expectArrow also fails in LTR on a component that hard-codes the wrong
// arrow (here ArrowLeft as "forward" whatever the direction), not only in RTL.
import { type KeyboardEvent, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectArrow, renderDir } from './support/index.ts';

function LeftIsForward() {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
    if (step === 0) return;
    const next = Math.min(2, Math.max(0, active + step));
    setActive(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="toolbar" aria-label="tools" onKeyDown={onKeyDown}>
      {['a', 'b', 'c'].map((label, i) => (
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

describe('expectArrow in LTR', () => {
  it('fails when ArrowLeft moves forward in an LTR region', async () => {
    const screen = await renderDir(<LeftIsForward />, { dir: 'ltr' });
    await expect(
      expectArrow({ dir: 'ltr', items: screen.getByRole('button').elements() }),
    ).rejects.toThrow();
  });

  it('passes the same component in RTL, where ArrowLeft is forward', async () => {
    const screen = await renderDir(<LeftIsForward />, { dir: 'rtl' });
    await expectArrow({ dir: 'rtl', items: screen.getByRole('button').elements() });
  });
});
