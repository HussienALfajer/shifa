// Review findings N3–N5 of slice 0.4-12 (reviewer agent, 2026-11-23), one test each:
// N3: Pagination fills its container, so in a row that pushes it to the end it never collapses
//     to no width with its buttons outside;
// N4: the Arabic result count follows CLDR's plural rules (103 is «نتائج», 100 «نتيجة»);
// N5: NumberInput and DatePicker store nothing in the browser either (OD-67).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderDir } from '../test/support/index.ts';
import { resultsAnnouncement } from './combobox/combobox.tsx';
import { DatePicker } from './date-picker/date-picker.tsx';
import { Form, FormField, useShifaForm } from './form/form.tsx';
import { NumberInput } from './number-input/number-input.tsx';
import { Pagination } from './pagination/pagination.tsx';

describe('N3: Pagination in a row that pushes it to the end', () => {
  it.each(['rtl', 'ltr'] as const)('keeps every button inside the row in %s', async (dir) => {
    const screen = await renderDir(
      <div data-testid="row" style={{ display: 'flex', justifyContent: 'flex-end', width: 360 }}>
        <Pagination page={3} pageSize={25} totalItems={312} onPageChange={() => undefined} />
      </div>,
      { dir },
    );
    const row = document.querySelector('[data-testid="row"]')?.getBoundingClientRect();
    if (row === undefined) throw new Error('no row');
    const buttons = [...document.querySelectorAll<HTMLElement>('nav button')].filter(
      (b) => b.offsetParent !== null,
    );
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      expect(r.left).toBeGreaterThanOrEqual(row.left - 1);
      expect(r.right).toBeLessThanOrEqual(row.right + 1);
    }
    await screen.unmount();
  });
});

describe('N4: Arabic plural forms of the result count', () => {
  it.each([
    [0, 'لا نتائج'],
    [1, 'نتيجة واحدة'],
    [2, 'نتيجتان'],
    [3, '3 نتائج'],
    [10, '10 نتائج'],
    [11, '11 نتيجة'],
    [100, '100 نتيجة'],
    [101, '101 نتيجة'],
    [102, '102 نتيجة'],
    [103, '103 نتائج'],
  ])('%i → %s', (count, words) => {
    expect(resultsAnnouncement(count, 'rtl')).toBe(words);
  });
});

const schema = z.object({ age: z.string(), birth: z.string() });

function Fields({ birthToken }: { birthToken?: string }) {
  const form = useShifaForm(schema, { defaultValues: { age: '', birth: '' } });
  return (
    <Form form={form} onSubmit={() => undefined} translate={(key) => key}>
      <NumberInput label="العمر" />
      <FormField
        name="birth"
        label="تاريخ الميلاد"
        {...(birthToken ? { autoComplete: birthToken } : {})}
      >
        {() => <DatePicker label="تاريخ الميلاد" />}
      </FormField>
    </Form>
  );
}

describe('N5: NumberInput and DatePicker autocomplete (OD-67)', () => {
  it('both are off by default', async () => {
    const screen = await renderDir(<Fields />);
    const inputs = [...document.querySelectorAll('input:not([type="hidden"])')];
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    for (const input of inputs) expect(input.getAttribute('autocomplete')).toBe('off');
    await screen.unmount();
  });

  it('a FormField token reaches the date field', async () => {
    const screen = await renderDir(<Fields birthToken="bday" />);
    const tokens = [...document.querySelectorAll('input:not([type="hidden"])')].map((i) =>
      i.getAttribute('autocomplete'),
    );
    // Since 0.4-13 the date is three segments, each with its part of the token.
    expect(tokens).toEqual(expect.arrayContaining(['bday-day', 'bday-month', 'bday-year']));
    await screen.unmount();
  });
});
