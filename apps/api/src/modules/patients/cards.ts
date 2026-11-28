// A chart as the answers show it (`PatientCard`; A-03 screen contract, "A chart in an answer"):
// search, family lists and duplicate candidates (A-03-04).
import { type FamilyMember, type PatientCard, patientDisplayName } from '@shifa/contracts';
import type { patient } from '@shifa/db';

export type ChartRow = typeof patient.$inferSelect;

export function cardOf(row: ChartRow): PatientCard {
  return {
    id: row.id,
    displayName: patientDisplayName(row),
    fileNumber: row.fileNumber,
    sex: row.sex,
    birthDate: row.birthDate,
    birthDateEstimated: row.birthDateEstimated,
    contactPhone: row.contactPhone,
    state: row.state,
  };
}

export function memberOf(row: ChartRow): FamilyMember {
  return { ...cardOf(row), relation: row.relation };
}
