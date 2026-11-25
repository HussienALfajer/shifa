// Playgrounds of the fields with a popup: Select, Combobox, DatePicker, TimeInput (playground.ts
// has the rest and the rules). Each can mount open at rest (`defaultOpen`, OD-119), and Combobox
// with typed text (`defaultInputValue`), so a scenario shows the open list as the views do.
import { field, flag, NONE, once, type Playground, pick, text } from './controls.ts';
import { DOCTORS, PATIENTS } from './data.ts';

export const PICKER_PLAYGROUNDS: Record<string, Playground> = {
  Select: {
    base: { items: DOCTORS },
    controls: [
      ...field('الطبيب'),
      text('placeholder', 'اختر الطبيب'),
      flag('required'),
      flag('disabled'),
      once(flag('defaultOpen')),
      once(
        pick('defaultValue', [NONE, ...DOCTORS.map((d) => ({ value: d.value, label: d.label }))]),
      ),
    ],
    scenarios: [
      { label: 'Chosen', set: { defaultValue: DOCTORS[0]?.value ?? '' } },
      { label: 'Open', set: { defaultOpen: true, defaultValue: DOCTORS[0]?.value ?? '' } },
      { label: 'Error', set: { error: 'اختر الطبيب قبل الحفظ' } },
    ],
  },
  Combobox: {
    base: { items: PATIENTS },
    controls: [
      ...field('المريض'),
      text('placeholder', 'ابحث بالاسم'),
      text('emptyMessage', 'لا يوجد مريض بهذا الاسم'),
      flag('disabled'),
      once(flag('defaultOpen')),
      once(text('defaultInputValue', '')),
      once(
        pick('defaultValue', [
          NONE,
          ...PATIENTS.slice(0, 3).map((x) => ({ value: x.value, label: x.label })),
        ]),
      ),
    ],
    scenarios: [
      { label: 'Chosen', set: { defaultValue: PATIENTS[0]?.value ?? '' } },
      { label: 'Open, typed', set: { defaultOpen: true, defaultInputValue: 'عب' } },
      { label: 'Open, no match', set: { defaultOpen: true, defaultInputValue: 'زز' } },
      { label: 'Error', set: { error: 'اختر مريضاً مسجلاً' } },
    ],
  },
  DatePicker: {
    base: {},
    controls: [
      ...field('تاريخ الموعد', 'يمكن الكتابة مباشرة'),
      flag('showAge'),
      flag('required'),
      flag('disabled'),
      once(flag('defaultOpen')),
      once(pick('defaultValue', [NONE, '2026-11-24', '1990-04-12'])),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true, defaultValue: '2026-11-24' } },
      {
        label: 'Birth date, age',
        set: { label: 'تاريخ الميلاد', showAge: true, defaultValue: '1990-04-12' },
      },
      { label: 'Error', set: { error: 'اختر تاريخاً من اليوم فصاعداً', defaultValue: '2026-11-24' } },
    ],
  },
  TimeInput: {
    base: { min: '09:00', max: '17:00' },
    controls: [
      ...field('وقت الموعد', 'دوام العيادة 09:00 – 17:00'),
      pick('hourCycle', [
        { value: 24, label: '24 ساعة' },
        { value: 12, label: '12 ساعة (ص/م)' },
      ]),
      flag('required'),
      flag('readOnly'),
      flag('disabled'),
      once(flag('defaultOpen')),
      once(pick('defaultValue', [NONE, '10:30', '14:30'])),
    ],
    scenarios: [
      { label: 'Open', set: { defaultOpen: true, defaultValue: '10:30' } },
      { label: '12-hour', set: { hourCycle: 12, defaultValue: '14:30' } },
      { label: 'Error', set: { error: 'اختر وقتاً بين 09:00 و17:00', defaultValue: '14:30' } },
    ],
  },
};
