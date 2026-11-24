// Words of the clinic chooser (slice A-01-07 checkpoint 4; improvement e): the last activity in
// words («آخر نشاط قبل 3 ساعات», «آخر نشاط أمس 18:40», a date beyond), role names, and the
// branches as one list («الفرع الرئيسي والفرع الثاني»). Device clock, Western digits (OD-20).
import type { CommonKey } from '@shifa/i18n';
import { FORMAT_LOCALE } from '@shifa/i18n/runtime';
import { clockTime, dayDate } from '../auth/dates.ts';

export type Role = 'owner' | 'doctor' | 'assistant' | 'receptionist' | 'accountant';

export const ROLE_TEXT: Record<Role, CommonKey> = {
  owner: 'chooserRoleOwner',
  doctor: 'setupRoleDoctor',
  assistant: 'setupRoleAssistant',
  receptionist: 'setupRoleReceptionist',
  accountant: 'setupRoleAccountant',
};

export interface Phrase {
  key: CommonKey;
  values: Record<string, unknown>;
}

const startOfDay = (at: number) => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** The last activity in words, from the server's time; the device's clock and time zone. */
export function lastActive(at: number, now: number): Phrase {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 60) return { key: 'chooserActiveMinutes', values: { count: minutes } };
  const today = startOfDay(now);
  if (at >= today || minutes < 6 * 60) {
    return { key: 'chooserActiveHours', values: { count: Math.floor(minutes / 60) } };
  }
  if (at >= today - 86_400_000) {
    return { key: 'chooserActiveYesterday', values: { time: clockTime(at) } };
  }
  return { key: 'chooserActiveOn', values: { date: dayDate(at) } };
}

const LIST = new Intl.ListFormat(FORMAT_LOCALE, { type: 'conjunction' });

/** «الفرع الرئيسي والفرع الثاني». */
export function listOf(names: string[]): string {
  return LIST.format(names);
}
