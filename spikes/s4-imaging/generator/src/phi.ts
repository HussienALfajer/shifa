// PHI tag check for the public CBCT (criterion 7). Every tag in the patient and study identity
// set must be absent, empty or a recognised placeholder; the check returns the keywords of the
// tags that fail (never their values). Synthetic data passes through its S4SYN marker.

import type { DicomDataset } from './dicom.ts';
import { SYNTHETIC_MARKER } from './dicom.ts';

/** Patient and study identity tags that must be empty, absent or a placeholder. */
export const PHI_TAGS: readonly string[] = [
  'PatientName',
  'PatientID',
  'PatientBirthDate',
  'PatientBirthTime',
  'OtherPatientIDs',
  'OtherPatientIDsSequence',
  'OtherPatientNames',
  'PatientBirthName',
  'PatientMotherBirthName',
  'PatientAddress',
  'PatientTelephoneNumbers',
  'MedicalRecordLocator',
  'InstitutionName',
  'InstitutionAddress',
  'InstitutionalDepartmentName',
  'ReferringPhysicianName',
  'PerformingPhysicianName',
  'OperatorsName',
  'NameOfPhysiciansReadingStudy',
  'PhysiciansOfRecord',
  'RequestingPhysician',
  'AccessionNumber',
  'StudyDate',
  'SeriesDate',
  'AcquisitionDate',
  'ContentDate',
  'AcquisitionDateTime',
  'DeviceSerialNumber',
];

/** Values de-identification tools and this spike use in place of identity. */
const PLACEHOLDER =
  /^(|anonymous|anonymized|anonymised|anon|deidentified|de-identified|removed|unknown|none|n\/a|na|0+|x+)$/i;
/** Dates that carry no real date: empty, all zeros, or 1 January 1900/1970. */
const PLACEHOLDER_DATE = /^(|0{8}|19000101|19700101)$/;
const DATE_TAGS = new Set([
  'PatientBirthDate',
  'StudyDate',
  'SeriesDate',
  'AcquisitionDate',
  'ContentDate',
]);

function text(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(text);
  if (typeof value === 'object') {
    // Person names: { Alphabetic, Ideographic, Phonetic }; sequences: nested datasets.
    return Object.values(value as Record<string, unknown>).flatMap(text);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return [String(value).trim()];
  }
  // Binary values (ArrayBuffer) carry no identity text.
  return [];
}

function isPlaceholder(keyword: string, value: string): boolean {
  if (value.startsWith(SYNTHETIC_MARKER)) return true;
  if (DATE_TAGS.has(keyword) || keyword === 'AcquisitionDateTime') {
    return PLACEHOLDER_DATE.test(value.slice(0, 8));
  }
  return PLACEHOLDER.test(value);
}

/** Keywords of the tags that hold something other than a placeholder (never the values). */
export function checkPhi(dataset: DicomDataset): string[] {
  return PHI_TAGS.filter((keyword) =>
    text(dataset[keyword]).some((value) => !isPlaceholder(keyword, value)),
  );
}
