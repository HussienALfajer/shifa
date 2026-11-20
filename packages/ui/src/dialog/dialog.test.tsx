// Dialog beyond the gate (slice 0.4-04 review): focus starts on the first field a person can
// reach (a Select's trigger counts), never on a hidden or disabled control.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DOCTORS } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { Select } from '../select/select.tsx';
import { Dialog, DialogActions, DialogClose, DialogContent, DialogTrigger } from './dialog.tsx';

const ITEMS = DOCTORS.map((d) => ({ value: d.id, label: d.name }));

describe.each(['rtl', 'ltr'] as const)('Dialog focus in %s', (dir) => {
  it('starts on the Select when it is the first field, skipping a disabled one', async () => {
    const screen = await renderDir(
      <Dialog>
        <DialogTrigger>موعد جديد</DialogTrigger>
        <DialogContent title="موعد جديد">
          <label>
            الرقم
            <input disabled />
          </label>
          <Select label="الطبيب" items={ITEMS} placeholder="اختر الطبيب" />
          <label>
            ملاحظة
            <input />
          </label>
          <DialogActions>
            <DialogClose>رجوع</DialogClose>
          </DialogActions>
        </DialogContent>
      </Dialog>,
      { dir },
    );
    await userEvent.click(screen.getByRole('button', { name: 'موعد جديد' }));
    await expect
      .poll(() => document.activeElement, { timeout: 1000 })
      .toBe(screen.getByRole('combobox', { name: 'الطبيب' }).element());
  });
});
