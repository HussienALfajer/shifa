// What admin web's flags, announcements, cities and areas read (A-02-09): three flags (never
// changed, on for all, switched off for all after running in one clinic) and one for selected
// clinics; four announcements (active warning to all, active information to three clinics,
// scheduled, ended early); Aleppo with its areas, Azaz without areas, archived Afrin and an
// archived area. Synthetic only, typed from the contracts; names from @shifa/testing.
import type { Announcement, City, FlagView } from '@shifa/contracts';
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { ago, at, id } from './world.ts';
import {
  ACTIVE_CLINIC,
  ADMIN_NAME,
  CLINIC_NAMES,
  PENDING_CLINIC,
  TRIAL_CLINIC,
} from './world-admin.ts';

const random = createRandom(2026_11_28);
/** Another super admin, who changed a flag before. */
export const OTHER_ADMIN = fullName(
  generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }),
);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const CLINIC_REF = {
  active: { id: ACTIVE_CLINIC, name: CLINIC_NAMES.active },
  pending: { id: PENDING_CLINIC, name: CLINIC_NAMES.pending },
  trial: { id: TRIAL_CLINIC, name: CLINIC_NAMES.trial },
};

function flags(): FlagView[] {
  return [
    {
      key: 'ui.new_schedule_grid',
      description: 'Weekly grid instead of the list',
      defaultValue: false,
      mode: 'off',
      clinics: [],
      reason: null,
      updatedByName: null,
      updatedAt: null,
    },
    {
      key: 'queue.voice_calls',
      description: 'Call the next patient by voice on the display',
      defaultValue: false,
      mode: 'selected',
      clinics: [CLINIC_REF.active, CLINIC_REF.trial],
      reason: 'تجربة النداء الصوتي في عيادتين قبل التعميم',
      updatedByName: ADMIN_NAME,
      updatedAt: ago(26 * HOUR),
    },
    {
      key: 'sync.batch_upload',
      description: 'Send offline changes together',
      defaultValue: false,
      mode: 'on',
      clinics: [],
      reason: 'نجحت التجربة في ثلاث عيادات',
      updatedByName: OTHER_ADMIN,
      updatedAt: ago(5 * DAY),
    },
    {
      key: 'reports.daily_pdf',
      description: 'Daily PDF summary for the owner',
      defaultValue: false,
      mode: 'off',
      clinics: [CLINIC_REF.active],
      reason: 'خطأ في الأرقام العربية، أوقفت حتى الإصلاح',
      updatedByName: ADMIN_NAME,
      updatedAt: ago(2 * DAY),
    },
  ];
}

/** The announcement bodies the sheets press on. */
export const ANN = {
  maintenance: 'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
  places: 'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
  training: 'تدريب على جدول المواعيد الجديد يوم السبت عبر الهاتف.',
  team: 'تحديث جديد لصفحة الفريق.',
};

const base = {
  version: 1,
  endedEarly: false,
  endedByName: null,
  createdByName: ADMIN_NAME,
} as const;

function announcements(): Announcement[] {
  return [
    {
      ...base,
      id: id(81),
      body: ANN.maintenance,
      level: 'warning',
      startsAt: ago(2 * HOUR),
      endsAt: at(10 * HOUR),
      status: 'active',
      target: 'all',
      clinics: [],
      createdAt: ago(3 * HOUR),
      dismissedCount: 31,
      targetedMembers: 118,
    },
    {
      ...base,
      id: id(82),
      body: ANN.places,
      level: 'info',
      startsAt: ago(1 * DAY),
      endsAt: null,
      status: 'active',
      target: 'selected',
      clinics: [CLINIC_REF.active, CLINIC_REF.pending, CLINIC_REF.trial],
      createdByName: OTHER_ADMIN,
      createdAt: ago(1 * DAY),
      dismissedCount: 12,
      targetedMembers: 40,
    },
    {
      ...base,
      id: id(83),
      body: ANN.training,
      level: 'info',
      startsAt: at(30 * HOUR),
      endsAt: at(50 * HOUR),
      status: 'scheduled',
      target: 'selected',
      clinics: [CLINIC_REF.active, CLINIC_REF.pending],
      createdAt: ago(4 * HOUR),
      dismissedCount: null,
      targetedMembers: null,
    },
    {
      ...base,
      id: id(84),
      body: ANN.team,
      level: 'info',
      startsAt: ago(12 * DAY),
      endsAt: ago(10 * DAY),
      status: 'ended',
      endedEarly: true,
      endedByName: ADMIN_NAME,
      target: 'all',
      clinics: [],
      createdAt: ago(12 * DAY),
      dismissedCount: 90,
      targetedMembers: 105,
    },
  ];
}

export const ALEPPO = id(85);
export const AZAZ = id(86);
export const AFRIN = id(87);

const area = (n: number, name: string, branches = 0, clinics = 0, doctors = 0) => ({
  id: id(n),
  cityId: ALEPPO,
  name,
  archivedAt: null as string | null,
  branchCount: branches,
  clinicCount: clinics,
  doctorCount: doctors,
});

function cities(): City[] {
  return [
    {
      id: ALEPPO,
      name: 'حلب',
      archivedAt: null,
      branchCount: 14,
      clinicCount: 11,
      doctorCount: 34,
      areas: [
        area(88, 'الجميلية', 3, 3, 9),
        area(89, 'العزيزية', 2, 2, 5),
        area(90, 'الشهباء', 5, 4, 11),
        area(91, 'الفرقان', 1, 1, 2),
        area(92, 'حلب الجديدة', 2, 2, 6),
        area(93, 'السبيل'),
        { ...area(94, 'الكلاسة', 1, 1, 2), archivedAt: ago(25 * DAY) },
      ],
    },
    {
      id: AZAZ,
      name: 'أعزاز',
      archivedAt: null,
      branchCount: 2,
      clinicCount: 2,
      doctorCount: 4,
      areas: [],
    },
    {
      id: AFRIN,
      name: 'عفرين',
      archivedAt: ago(25 * DAY),
      branchCount: 0,
      clinicCount: 0,
      doctorCount: 0,
      areas: [],
    },
  ];
}

export interface AdminA02World {
  flags: FlagView[];
  announcements: Announcement[];
  cities: City[];
}

export function adminA02World(): AdminA02World {
  return { flags: flags(), announcements: announcements(), cities: cities() };
}
