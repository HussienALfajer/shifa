// Fixtures of admin web's flags, announcements, cities and areas (slice A-02-09), as drawn on
// "Shifa Screens · Admin web" (`A02Flags`, `A02Announcements`, `A02Cities`, approved in A-02-01):
// a signed-in super admin, the clinics of the picker, and the answers of the contract rows.
// Synthetic only. `queries` records the query string of every request (the fake API keys answers
// by path alone).
import { act } from 'react';
import { ACTIVE, adminApi, ENDING, FIVE, PENDING } from './admin-support.ts';
import type { FakeApi } from './support.ts';

export const U = (n: number) => `7a2e4c1e-4a43-4f0e-9f61-3c3b1f6f0e${String(n).padStart(2, '0')}`;

export const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;

export const ADMIN_NAME = 'مريم قدور';

export const KILLED = {
  key: 'reports.daily_pdf',
  description: 'Daily PDF summary for the owner',
  defaultValue: false,
  mode: 'off' as const,
  clinics: [{ id: ACTIVE.id, name: ACTIVE.name }],
  reason: 'خطأ في الأرقام العربية، أوقفت حتى الإصلاح',
  updatedByName: ADMIN_NAME,
  updatedAt: iso(NOW - 48 * HOUR),
};
export const ON_ALL = {
  key: 'sync.batch_upload',
  description: 'Send offline changes together',
  defaultValue: false,
  mode: 'on' as const,
  clinics: [],
  reason: 'نجحت التجربة في ثلاث عيادات',
  updatedByName: 'بلال الأسعد',
  updatedAt: iso(NOW - 120 * HOUR),
};
export const UNTOUCHED = {
  key: 'ui.new_schedule_grid',
  description: 'Weekly grid instead of the list',
  defaultValue: false,
  mode: 'off' as const,
  clinics: [],
  reason: null,
  updatedByName: null,
  updatedAt: null,
};
export const FLAGS = [UNTOUCHED, ON_ALL, KILLED];

interface Ann {
  id: string;
  version: number;
  body: string;
  level: 'info' | 'warning';
  startsAt: string;
  endsAt: string | null;
  status: 'scheduled' | 'active' | 'ended';
  endedEarly: boolean;
  endedByName: string | null;
  target: 'all' | 'selected';
  clinics: { id: string; name: string }[];
  createdByName: string | null;
  createdAt: string;
  dismissedCount: number | null;
  targetedMembers: number | null;
}

export const MAINTENANCE: Ann = {
  id: U(1),
  version: 1,
  body: 'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
  level: 'warning',
  startsAt: iso(NOW - 2 * HOUR),
  endsAt: iso(NOW + 10 * HOUR),
  status: 'active',
  endedEarly: false,
  endedByName: null,
  target: 'all',
  clinics: [],
  createdByName: ADMIN_NAME,
  createdAt: iso(NOW - 3 * HOUR),
  dismissedCount: 31,
  targetedMembers: 118,
};
export const PLACES_NEWS: Ann = {
  ...MAINTENANCE,
  id: U(2),
  body: 'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
  level: 'info',
  endsAt: null,
  target: 'selected',
  clinics: [
    { id: ACTIVE.id, name: ACTIVE.name },
    { id: PENDING.id, name: PENDING.name },
    { id: ENDING.id, name: ENDING.name },
  ],
  dismissedCount: 12,
  targetedMembers: 40,
};
export const TRAINING: Ann = {
  ...MAINTENANCE,
  id: U(3),
  body: 'تدريب على جدول المواعيد الجديد يوم السبت عبر الهاتف.',
  level: 'info',
  startsAt: iso(NOW + 30 * HOUR),
  endsAt: iso(NOW + 50 * HOUR),
  status: 'scheduled',
  target: 'selected',
  clinics: [
    { id: ACTIVE.id, name: ACTIVE.name },
    { id: PENDING.id, name: PENDING.name },
  ],
  dismissedCount: null,
  targetedMembers: null,
};
export const ENDED_EARLY: Ann = {
  ...MAINTENANCE,
  id: U(4),
  body: 'تحديث جديد لصفحة الفريق.',
  level: 'info',
  startsAt: iso(NOW - 300 * HOUR),
  endsAt: iso(NOW - 250 * HOUR),
  status: 'ended',
  endedEarly: true,
  endedByName: ADMIN_NAME,
  dismissedCount: 90,
  targetedMembers: 105,
};
export const ANNOUNCEMENTS = [MAINTENANCE, PLACES_NEWS, TRAINING, ENDED_EARLY];

const area = (n: number, name: string, branches = 0, clinics = 0, doctors = 0) => ({
  id: U(40 + n),
  cityId: U(30),
  name,
  archivedAt: null as string | null,
  branchCount: branches,
  clinicCount: clinics,
  doctorCount: doctors,
});
export const SHAHBA = area(1, 'الشهباء', 5, 4, 11);
export const JAMILIYEH = area(2, 'الجميلية', 3, 3, 9);
export const SABIL = area(3, 'السبيل');
export const KALLASEH = { ...area(4, 'الكلاسة', 1, 1, 2), archivedAt: iso(NOW - 600 * HOUR) };
export const ALEPPO = {
  id: U(30),
  name: 'حلب',
  archivedAt: null as string | null,
  branchCount: 14,
  clinicCount: 11,
  doctorCount: 34,
  areas: [JAMILIYEH, SHAHBA, SABIL],
};
export const AZAZ = {
  id: U(31),
  name: 'أعزاز',
  archivedAt: null as string | null,
  branchCount: 2,
  clinicCount: 2,
  doctorCount: 4,
  areas: [] as (typeof ALEPPO)['areas'],
};
export const AFRIN = {
  ...AZAZ,
  id: U(32),
  name: 'عفرين',
  archivedAt: iso(NOW - 600 * HOUR),
  branchCount: 0,
  clinicCount: 0,
  doctorCount: 0,
};

export interface A02Api extends FakeApi {
  /** The query string of every request, by path, in order. */
  queries: Record<string, string[]>;
}

/** The super admin's fake API with the five clinics, these flags, announcements and cities. */
export function a02Api({
  flags = FLAGS,
  announcements = ANNOUNCEMENTS,
  cities = [ALEPPO, AZAZ],
  archivedCities = [ALEPPO_WITH_ARCHIVED, AZAZ, AFRIN],
}: {
  flags?: unknown[];
  announcements?: Ann[];
  cities?: unknown[];
  archivedCities?: unknown[];
} = {}): A02Api {
  const fake = adminApi(FIVE) as A02Api;
  fake.queries = {};
  const inner = fake.fetch;
  let lastAnnStatus = '';
  let lastArchived = false;
  fake.fetch = async (request) => {
    const url = new URL(request.url);
    (fake.queries[url.pathname] ??= []).push(url.search);
    if (url.pathname === '/api/platform/announcements') {
      lastAnnStatus = url.searchParams.get('status') ?? '';
    }
    if (url.pathname === '/api/platform/cities') {
      lastArchived = url.searchParams.get('includeArchived') === 'true';
    }
    return inner(request);
  };
  fake.answers['/api/platform/flags'] = () => jsonOk({ flags });
  fake.answers['/api/platform/announcements'] = () => {
    const counts = {
      scheduled: announcements.filter((a) => a.status === 'scheduled').length,
      active: announcements.filter((a) => a.status === 'active').length,
      ended: announcements.filter((a) => a.status === 'ended').length,
    };
    const rows =
      lastAnnStatus === ''
        ? announcements
        : announcements.filter((a) => a.status === lastAnnStatus);
    return jsonOk({ counts, announcements: rows });
  };
  fake.answers['/api/platform/cities'] = () =>
    jsonOk({ cities: lastArchived ? archivedCities : cities });
  return fake;
}

export const ALEPPO_WITH_ARCHIVED = { ...ALEPPO, areas: [...ALEPPO.areas, KALLASEH] };

const jsonOk = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Types into a textarea the way a person does, so React sees the change. */
export async function typeArea(area: HTMLTextAreaElement, value: string): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  await act(async () => {
    descriptor?.set?.call(area, value);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

/**
 * The textarea labelled `name` (the label may end with the required mark). Not the first
 * textarea: MultiCombobox renders a hidden one for its form value (owner, 2026-11-27).
 */
export function areaLabelled(root: ParentNode, name: string): HTMLTextAreaElement {
  for (const label of root.querySelectorAll('label')) {
    if (label.textContent.replace('*', '').trim() !== name) continue;
    const el = label.htmlFor ? document.getElementById(label.htmlFor) : null;
    if (el instanceof HTMLTextAreaElement) return el;
  }
  throw new Error(`no textarea labelled ${name}`);
}

/** The value, or a failed test naming what is missing. */
export function must<T>(value: T | null | undefined, what = 'element'): T {
  if (value === null || value === undefined) throw new Error(`no ${what}`);
  return value;
}

/** The open dialog or confirmation, wherever it is portalled. */
export const dialog = () =>
  document.body.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]');

/** The radio whose label reads `name`, inside `root`. */
export function radio(root: ParentNode, name: string): HTMLElement {
  for (const el of root.querySelectorAll<HTMLElement>('[role="radio"]')) {
    const label = el.closest('label')?.textContent ?? el.getAttribute('aria-label') ?? '';
    if (label.includes(name) || el.parentElement?.textContent.includes(name)) return el;
  }
  throw new Error(`no radio ${name}`);
}

/** An option of the status filter: its label, then its count. */
export function segment(label: string): HTMLElement {
  const filter = document.querySelector('[aria-label="حالة الإعلان"]');
  for (const b of filter?.querySelectorAll<HTMLElement>('button') ?? []) {
    if (b.textContent.trim().startsWith(label)) return b;
  }
  throw new Error(`no segment ${label}`);
}

/** The row (a list item of the page) that reads `text`. */
export function rowWith(text: string): HTMLElement | null {
  for (const row of document.querySelectorAll<HTMLElement>('[data-row]')) {
    if (row.textContent.includes(text)) return row;
  }
  return null;
}
