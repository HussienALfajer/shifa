// The open views of the fields with a popup (OD-119): each mounts the real component open at rest
// (`defaultOpen`), Combobox with typed text (`defaultInputValue`). Chosen in Tweaks (`view`), as
// Menu's are; theme, density and direction are the board's own tweaks. Synthetic data only.
import { DOCTORS, PATIENTS } from './data.ts';
import type { OpenView } from './types.ts';

const COMBOBOX = {
  label: 'المريض',
  items: PATIENTS,
  emptyMessage: 'لا يوجد مريض بهذا الاسم',
  placeholder: 'ابحث بالاسم',
  defaultOpen: true,
};
const TIME = { label: 'وقت الموعد', min: '09:00', max: '17:00', defaultOpen: true };

export const FIELD_OPEN_VIEWS: Record<
  'Select' | 'Combobox' | 'DatePicker' | 'TimeInput',
  OpenView[]
> = {
  Select: [
    {
      suffix: 'OpenList',
      label: 'مفتوحة · القائمة',
      h: 560,
      cap: 'Open: the chosen doctor with its check, an unavailable one with its reason',
      p: { label: 'الطبيب', items: DOCTORS, defaultValue: '1001', defaultOpen: true },
    },
  ],
  Combobox: [
    {
      suffix: 'OpenTyped',
      label: 'مفتوحة · «عب»',
      h: 560,
      cap: 'Open with «عب» typed: three suggestions, the typed part in bold',
      p: { ...COMBOBOX, defaultInputValue: 'عب' },
    },
    {
      suffix: 'OpenNoMatch',
      label: 'مفتوحة · لا نتائج',
      h: 420,
      cap: 'Open with «زز» typed: nothing matches, the empty message',
      p: { ...COMBOBOX, defaultInputValue: 'زز' },
    },
  ],
  DatePicker: [
    {
      suffix: 'OpenCalendar',
      label: 'مفتوحة · التقويم',
      h: 680,
      cap: 'Open: the calendar on the chosen day’s month, the chosen day filled, today ringed',
      p: { label: 'تاريخ الموعد', defaultValue: '2026-11-24', defaultOpen: true },
    },
  ],
  TimeInput: [
    {
      suffix: 'OpenSlots24',
      label: 'مفتوحة · 24 ساعة',
      h: 760,
      cap: 'Open: the clinic’s slots on the 24-hour clock, the chosen time pressed',
      p: { ...TIME, defaultValue: '10:30' },
    },
    {
      suffix: 'OpenSlots12',
      label: 'مفتوحة · 12 ساعة',
      h: 760,
      cap: 'Open: the slots on the 12-hour clock (ص/م), the chosen time pressed',
      p: { ...TIME, defaultValue: '10:30', hourCycle: 12 },
    },
  ],
};
