// Time Input slots (slice 0.4-13 criterion 19, OD-70 B, OD-73): times at `step` minutes (default
// 15) from `min` up to, not including, `max`; grouped ليلاً 00–06, صباحاً 06–12, بعد الظهر 12–17,
// مساءً 17–24, empty groups dropped; "HH:mm" or "hh:mm ص/م"; a step that does not divide 60 is
// refused; the next slot after now.
import { describe, expect, it } from 'vitest';
import { nextSlot, timeSlots } from './slots.ts';

const all = (groups: ReturnType<typeof timeSlots>) => groups.flatMap((g) => g.slots);

describe('timeSlots', () => {
  it('has 96 slots in four groups with no bounds', () => {
    const groups = timeSlots({ dir: 'rtl' });
    expect(all(groups)).toHaveLength(96);
    expect(groups.map((g) => [g.id, g.name, g.slots.length])).toEqual([
      ['night', 'ليلاً', 24],
      ['morning', 'صباحاً', 24],
      ['afternoon', 'بعد الظهر', 20],
      ['evening', 'مساءً', 28],
    ]);
    expect(groups.map((g) => g.name)).toEqual(['ليلاً', 'صباحاً', 'بعد الظهر', 'مساءً']);
    expect(timeSlots({ dir: 'ltr' }).map((g) => g.name)).toEqual([
      'Night',
      'Morning',
      'Afternoon',
      'Evening',
    ]);
  });

  it('runs from min up to, not including, max, and drops empty groups', () => {
    const groups = timeSlots({ min: '09:00', max: '17:00', dir: 'rtl' });
    expect(groups.map((g) => g.id)).toEqual(['morning', 'afternoon']);
    const slots = all(groups);
    expect(slots).toHaveLength(32);
    expect(slots[0]?.value).toBe('09:00');
    expect(slots.at(-1)?.value).toBe('16:45');
    expect(groups[0]?.slots.at(-1)?.value).toBe('11:45');
    expect(groups[1]?.slots[0]?.value).toBe('12:00');
  });

  it('keeps slots on the step from midnight when min is between steps', () => {
    expect(all(timeSlots({ min: '09:10', max: '10:00', dir: 'rtl' })).map((s) => s.value)).toEqual([
      '09:15',
      '09:30',
      '09:45',
    ]);
  });

  it('labels slots on the 24- and 12-hour clocks and names them with their group', () => {
    const day = all(timeSlots({ dir: 'rtl' }));
    const at = (value: string) => day.find((s) => s.value === value);
    expect(at('14:30')?.label).toBe('14:30');
    expect(at('10:30')?.name).toBe('10:30 صباحاً');
    const twelve = all(timeSlots({ dir: 'rtl', hourCycle: 12 }));
    const at12 = (value: string) => twelve.find((s) => s.value === value);
    expect(at12('10:30')?.label).toBe('10:30 ص');
    expect(at12('14:30')?.label).toBe('02:30 م');
    expect(at12('12:00')?.label).toBe('12:00 م');
    expect(at12('00:15')?.label).toBe('12:15 ص');
    const english = all(timeSlots({ dir: 'ltr', hourCycle: 12 }));
    expect(english.find((s) => s.value === '14:30')?.label).toBe('02:30 PM');
    expect(english.find((s) => s.value === '14:30')?.name).toBe('02:30 PM, afternoon');
  });

  it.each([
    [10, 144],
    [20, 72],
    [30, 48],
    [60, 24],
  ])('a step of %i gives %i slots', (step, count) => {
    expect(all(timeSlots({ step, dir: 'rtl' }))).toHaveLength(count);
  });

  it.each([7, 0, -15, 45])('refuses a step of %i in development', (step) => {
    expect(() => timeSlots({ step, dir: 'rtl' })).toThrow(/step/);
  });
});

describe('nextSlot', () => {
  const day = timeSlots({ min: '09:00', max: '17:00', dir: 'rtl' });

  it('is the first slot at or after now', () => {
    expect(nextSlot(day, 10 * 60 + 20)?.value).toBe('10:30');
    expect(nextSlot(day, 10 * 60 + 30)?.value).toBe('10:30');
  });

  it('is the first slot before opening hours, and the first one again after them', () => {
    expect(nextSlot(day, 7 * 60)?.value).toBe('09:00');
    expect(nextSlot(day, 18 * 60)?.value).toBe('09:00');
  });
});
