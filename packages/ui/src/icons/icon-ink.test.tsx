// Slice 0.4-09 (OD-65, spec 0.4 criterion 13): an icon's stroke follows the text colour of
// the control it sits in. Enabled, that is the icon ink (the text colour); disabled, it greys
// with the control's text, so a disabled field never shows a fully inked chevron or start icon.
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DOCTORS } from '../../test/fixtures.ts';
import { renderDir, tokenColor } from '../../test/support/index.ts';
import { Combobox } from '../combobox/combobox.tsx';
import { DatePicker } from '../date-picker/date-picker.tsx';
import { Input } from '../input/input.tsx';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../menu/menu.tsx';
import { Select } from '../select/select.tsx';
import { TimeInput } from '../time-input/time-input.tsx';

const ITEMS = DOCTORS.slice(0, 2).map((d) => ({ value: d.id, label: d.name }));

const CONTROLS: Record<string, (disabled: boolean) => ReactNode> = {
  Select: (disabled) => (
    <Select label="الطبيب" items={ITEMS} placeholder="اختر الطبيب" disabled={disabled} />
  ),
  Combobox: (disabled) => (
    <Combobox label="الطبيب" items={ITEMS} emptyMessage="لا نتائج" disabled={disabled} />
  ),
  DatePicker: (disabled) => (
    <DatePicker label="تاريخ الموعد" defaultValue="2026-11-24" disabled={disabled} />
  ),
  Input: (disabled) => (
    <Input label="الهاتف" startIcon="phone" defaultValue="0944" disabled={disabled} />
  ),
  TimeInput: (disabled) => <TimeInput label="الوقت" defaultValue="14:30" disabled={disabled} />,
  MenuTrigger: (disabled) => (
    <Menu>
      <MenuTrigger disabled={disabled}>إجراءات</MenuTrigger>
      <MenuContent>
        <MenuItem value="a">تأكيد الحضور</MenuItem>
      </MenuContent>
    </Menu>
  ),
};

describe.each(['light', 'dark'] as const)('icon ink inside controls (%s)', (theme) => {
  it.each(Object.keys(CONTROLS))(
    '%s: icon ink enabled, the disabled text colour disabled',
    async (name) => {
      for (const disabled of [false, true]) {
        const screen = await renderDir(CONTROLS[name]?.(disabled), { theme });
        const icons = [...screen.container.querySelectorAll('svg.tabler-icon')];
        const [first] = icons;
        if (first === undefined) throw new Error(`${name}: no icon drawn`);
        // Probed beside the icon, inside the theme region (dark is set there, not on the page).
        const want = tokenColor(
          disabled ? '--shifa-color-text-disabled' : '--shifa-color-icon-default',
          first,
        );
        for (const icon of icons) {
          expect(getComputedStyle(icon).stroke, `${name} disabled=${String(disabled)}`).toBe(want);
        }
        await screen.unmount();
      }
    },
  );
});
